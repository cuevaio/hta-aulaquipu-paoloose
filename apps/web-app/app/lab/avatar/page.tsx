"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AiTutor } from "@/lib/types";
import { AiTutorAvatar, type TutorAvatarState, type TutorGaze } from "@/components/classroom/ai-tutor-avatar";
import { useSyntheticLevel } from "@/lib/classroom/use-audio-level";
import { cn } from "@/lib/utils";

const STATES: TutorAvatarState[] = ["idle", "listening", "thinking", "speaking", "writing", "graphing", "celebrating"];
const GAZES: TutorGaze[] = ["center", "left", "right", "down"];

const chip = (on: boolean) =>
  cn("rounded-full px-3 py-1.5 text-sm font-extrabold transition-colors", on ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-secondary");

export default function AvatarLabPage() {
  const [tutors, setTutors] = useState<AiTutor[]>([]);
  const [state, setState] = useState<TutorAvatarState>("speaking");
  const [gaze, setGaze] = useState<TutorGaze>("center");
  const [manual, setManual] = useState(0.5);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listAiTutors().then((t) => alive && setTutors(t));
    return () => {
      alive = false;
    };
  }, []);

  const synthetic = useSyntheticLevel(auto && state === "speaking");
  const level = auto ? synthetic : manual;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-5">
      <div>
        <p className="text-sm font-bold text-primary">Laboratorio</p>
        <h1 className="font-heading text-3xl font-semibold">Avatar del tutor IA</h1>
        <p className="mt-1 text-muted-foreground">Prueba los estados, la mirada y el nivel de voz de cada tutor.</p>
      </div>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow">
        <div>
          <p className="mb-1.5 text-xs font-bold text-muted-foreground">Estado</p>
          <div className="flex flex-wrap gap-2">
            {STATES.map((s) => (
              <button key={s} onClick={() => setState(s)} className={chip(state === s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold text-muted-foreground">Mirada</p>
          <div className="flex flex-wrap gap-2">
            {GAZES.map((g) => (
              <button key={g} onClick={() => setGaze(g)} className={chip(gaze === g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Hablar automático
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            Nivel
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={auto ? level : manual}
              disabled={auto}
              onChange={(e) => setManual(Number(e.target.value))}
              aria-label="Nivel de voz"
            />
            <span className="w-10 tabular-nums">{level.toFixed(2)}</span>
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {tutors.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-3 rounded-3xl bg-navy-2 p-5 text-white">
            <AiTutorAvatar persona={{ ...t.persona, name: t.name }} state={state} level={level} gaze={gaze} size={160} />
            <p className="font-heading text-lg font-semibold">{t.name}</p>
            <p className="text-center text-xs text-white/70">{t.persona.tagline}</p>
          </div>
        ))}
        {tutors.length === 0 && <p className="text-muted-foreground">Cargando tutores…</p>}
      </section>
    </main>
  );
}
