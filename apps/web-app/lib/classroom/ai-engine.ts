// Tutor IA simulado: recorre un guion y emite eventos del aula por el transporte,
// como lo haría el agent-worker con tool-calling. Habla con Web Speech si está disponible.

import type { ClassroomEvent } from "@/lib/classroom/events";
import type { ClassroomTransport } from "@/lib/classroom/transport";
import type { ScriptStep } from "@/lib/classroom/ai-scripts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ANSWER_TIMEOUT_MS = 45_000;

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  const pref = ["es-pe", "es-419", "es-mx", "es-us", "es-co", "es-es"];
  for (const p of pref) {
    const v = voices.find((x) => x.lang.toLowerCase() === p);
    if (v) return v;
  }
  return voices[0] ?? null;
}

export class SimulatedAiTutor {
  private stopped = false;
  private unsub: (() => void) | null = null;
  private awaiting: ((text: string | null) => void) | null = null;
  private questions: string[] = [];
  /** Preguntas que el alumno falló: alimentan "Lo que te costó" del resumen. */
  private struggled: string[] = [];
  private quizWait: { id: string; resolve: (index: number | null) => void } | null = null;
  voice = true;

  constructor(
    private transport: ClassroomTransport,
    private actor: string,
    private name: string,
  ) {}

  private emit(e: ClassroomEvent) {
    this.transport.send(e);
  }

  async run(steps: ScriptStep[]) {
    this.unsub = this.transport.subscribe((e) => {
      if (e.type === "quiz_answer" && this.quizWait?.id === e.id) {
        const { resolve } = this.quizWait;
        this.quizWait = null;
        resolve(e.index);
        return;
      }
      if (e.type !== "chat" || e.actor === this.actor) return;
      if (this.awaiting) {
        const resolve = this.awaiting;
        this.awaiting = null;
        resolve(e.text);
      } else {
        this.questions.push(e.text);
      }
    });
    this.emit({ type: "session_event", actor: this.actor, kind: "join", payload: { name: this.name } });
    await sleep(1200);
    try {
      await this.runSteps(steps);
      if (!this.stopped) this.emit({ type: "session_event", actor: this.actor, kind: "script_done", payload: {} });
    } catch (err) {
      if (!this.stopped)
        this.emit({ type: "session_event", actor: this.actor, kind: "error", payload: { message: String(err) } });
    }
  }

  stop() {
    this.stopped = true;
    this.unsub?.();
    this.awaiting?.(null);
    this.quizWait?.resolve(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  /** Cierre de clase: escribe "Resumen de la clase" con lo que se vio en el documento y deja de hablar. */
  writeSummary(doc: string, topic: string) {
    const seen = [...doc.matchAll(/^#{1,3}\s+(.+)$/gm)]
      .map((m) => m[1].trim())
      .filter((h) => !/resumen|practicar/i.test(h) && h.toLowerCase() !== topic.toLowerCase());
    const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
    const markdown = [
      "### Lo que vimos",
      bullets(seen.length ? seen.slice(0, 5) : [`Una primera mirada a ${topic}.`]),
      "",
      "### Lo que te costó",
      bullets(this.struggled.length ? this.struggled.slice(0, 3).map((q) => `Repasa: ${q}`) : ["No hubo dificultades importantes en esta clase."]),
      "",
      "### 3 ejercicios para practicar",
      `1. Explica con tus palabras la idea central de ${topic}.`,
      "2. Inventa un ejemplo propio y resuélvelo paso a paso.",
      "3. Busca un error típico y escribe cómo lo evitarías.",
    ].join("\n");
    this.stop();
    this.emit({ type: "doc_section", actor: this.actor, section: "Resumen de la clase", markdown });
    this.emit({ type: "tool_action", actor: this.actor, tool: "docWrite", label: "Escrito en el documento: Resumen de la clase" });
  }

  private async runSteps(steps: ScriptStep[]) {
    for (const step of steps) {
      if (this.stopped) return;
      await this.answerQuestions();
      if ("quiz" in step) await this.quiz(step);
      else if ("ask" in step) await this.ask(step);
      else await this.teach(step);
      await sleep(500);
    }
  }

  private async answerQuestions() {
    while (this.questions.length && !this.stopped) {
      const q = this.questions.shift()!;
      this.emit({ type: "focus_tool", actor: this.actor, tool: "doc" });
      await Promise.all([
        this.say("¡Buena pregunta! La anoto en el documento y la tenemos en cuenta."),
        this.type(`\n> ❓ **Pregunta del alumno:** ${q}\n`),
      ]);
    }
  }

  private async quiz(step: Extract<ScriptStep, { quiz: unknown }>) {
    const { question, options, correctIndex, explanation } = step.quiz;
    const id = `local-quiz-${Date.now()}`;
    // Como en ask(): se escucha desde ya, el alumno puede tocar una opción mientras el tutor lee
    const pickP = new Promise<number | null>((resolve) => {
      this.quizWait = { id, resolve };
      setTimeout(() => {
        if (this.quizWait?.id === id) {
          this.quizWait = null;
          resolve(null);
        }
      }, ANSWER_TIMEOUT_MS);
    });
    this.emit({ type: "quiz_ask", actor: this.actor, id, question, options });
    await this.say(question);
    const index = await pickP;
    if (this.stopped) return;
    if (index === null) {
      await this.say("Te espero otro ratito. Sigamos, lo practicamos al final.");
      return;
    }
    const correct = index === correctIndex;
    if (!correct) this.struggled.push(question);
    this.emit({ type: "quiz_result", actor: this.actor, id, correct, correctIndex, explanation });
    this.emit({ type: "session_event", actor: this.actor, kind: "tool_call", payload: { tool: "quiz", id, correct } });
    this.emit({ type: "emote", actor: this.actor, kind: correct ? "celebrate" : "encourage" });
    await this.say(correct ? step.right : step.wrong);
  }

  private async ask(step: Extract<ScriptStep, { ask: string }>) {
    // Escuchamos desde ya: el alumno puede responder mientras el tutor aún lee la pregunta
    const answerP = new Promise<string | null>((resolve) => {
      this.awaiting = resolve;
      setTimeout(() => {
        if (this.awaiting === resolve) {
          this.awaiting = null;
          resolve(null);
        }
      }, ANSWER_TIMEOUT_MS);
    });
    this.emit({ type: "ask_student", actor: this.actor, question: step.ask });
    await this.say(step.ask);
    const answer = await answerP;
    if (this.stopped) return;
    this.emit({ type: "session_event", actor: this.actor, kind: "student_answer", payload: { question: step.ask, answer } });
    if (answer !== null && step.check && !step.check(answer)) this.struggled.push(step.ask);
    if (answer === null) {
      await this.say("Te espero otro ratito en la próxima. Sigamos, lo practicamos al final.");
      return;
    }
    const ok = step.check ? step.check(answer) : true;
    if (ok && step.check) this.emit({ type: "emote", actor: this.actor, kind: "celebrate" });
    if (ok) await this.say(step.right);
    else if (step.wrong.length) await this.runSteps(step.wrong);
    else await this.say(step.right);
  }

  private async teach(step: Exclude<ScriptStep, { ask: string } | { quiz: unknown }>) {
    if (step.focus) this.emit({ type: "focus_tool", actor: this.actor, tool: step.focus });
    if (step.clearBoard) this.emit({ type: "board_clear", actor: this.actor, target: "board" });
    const tools = (async () => {
      await sleep(300);
      for (const id of step.graphRemove ?? []) this.emit({ type: "graph_remove", actor: this.actor, id });
      for (const g of step.graph ?? []) {
        if (this.stopped) return;
        this.emit({ type: "graph_set", actor: this.actor, ...g });
        await sleep(900);
      }
      for (const [i, d] of (step.draw ?? []).entries()) {
        if (this.stopped) return;
        this.emit({
          type: "board_draw",
          actor: this.actor,
          stroke: { id: `${this.actor}-${Date.now()}-${i}`, color: d.color, width: 4, points: d.points, target: "board" },
        });
        await sleep(600);
      }
      if (step.write) await this.type(step.write);
      if (step.table) this.emit({ type: "doc_append_table", actor: this.actor, rows: step.table });
    })();
    await Promise.all([this.say(step.say), tools]);
  }

  /** Escribe en el documento en trozos, para que se vea "escribiendo mientras habla". */
  private async type(markdown: string) {
    const chunk = 5;
    for (let i = 0; i < markdown.length && !this.stopped; i += chunk) {
      this.emit({ type: "doc_write", actor: this.actor, markdown: markdown.slice(i, i + chunk), mode: "append" });
      await sleep(22);
    }
  }

  private async say(text: string) {
    if (this.stopped) return;
    this.emit({ type: "speech", actor: this.actor, text });
    this.emit({ type: "speaking", actor: this.actor, on: true });
    const estimate = Math.min(14_000, 900 + text.split(/\s+/).length * 330);
    const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
    if (this.voice && synth) {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        const v = pickSpanishVoice();
        if (v) u.voice = v;
        u.lang = v?.lang ?? "es-PE";
        u.rate = 1.05;
        u.pitch = 1.05;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        u.onend = finish;
        u.onerror = finish;
        // Salvaguarda: algunos navegadores nunca disparan onend
        setTimeout(finish, estimate * 1.8 + 2000);
        synth.speak(u);
      });
    } else {
      await sleep(estimate);
    }
    this.emit({ type: "speaking", actor: this.actor, on: false });
  }
}
