// Guiones del tutor IA simulado. Mientras el agent-worker (LiveKit Agents + Realtime API)
// no esté conectado, estos guiones ejercitan las mismas herramientas del §8.6.

import type { ClassroomTool, Point } from "@/lib/classroom/events";

export type ScriptStep =
  | {
      say: string;
      focus?: ClassroomTool;
      write?: string;
      table?: string[][];
      graph?: { id: string; latex: string; color?: string }[];
      graphRemove?: string[];
      draw?: { color: string; points: Point[] }[];
      clearBoard?: boolean;
    }
  | {
      /** Tarjeta de opción múltiple: se juzga en el aula, igual que haría el agente. */
      quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
      right: string;
      wrong: string;
    }
  | {
      ask: string;
      check?: (answer: string) => boolean;
      right: string;
      wrong: ScriptStep[];
    };

const circle = (cx: number, cy: number, r: number, from = 0, to = Math.PI * 2, n = 40): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
const line = (x1: number, y1: number, x2: number, y2: number): Point[] => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function fracciones(student: string): ScriptStep[] {
  return [
    {
      say: `¡Hola ${student}! Soy tu profe. Hoy vamos con fracciones, sin apuro. Primero quiero saber desde dónde partimos.`,
      focus: "doc",
      write: "# Fracciones\n\n",
    },
    {
      ask: "Cuéntame con tus palabras: ¿qué significa 3/4 para ti?",
      check: (a) => /parte|pedazo|divid|tres|cuatro|de\s*4/.test(a.toLowerCase()),
      right: "¡Bien! Ya tienes la idea de partes. Vamos a hacerla bien firme.",
      wrong: [{ say: "No pasa nada, para eso estamos. Lo vemos con un dibujo, que siempre ayuda." }],
    },
    {
      say: "Imagina una pizza partida en cuatro partes iguales. Si te comes tres, te comiste tres cuartos. El de abajo dice en cuántas partes cortamos; el de arriba, cuántas tomamos.",
      focus: "notebook",
      clearBoard: true,
      draw: [
        { color: "#7C6BF2", points: circle(0.5, 0.5, 0.3) },
        { color: "#7C6BF2", points: line(0.5, 0.2, 0.5, 0.8) },
        { color: "#7C6BF2", points: line(0.2, 0.5, 0.8, 0.5) },
        { color: "#2FD3A3", points: circle(0.5, 0.5, 0.15, Math.PI * 0.5, Math.PI * 2, 30) },
      ],
    },
    {
      say: "Te lo anoto en el documento para que no se te olvide.",
      focus: "doc",
      write:
        "## ¿Qué es una fracción?\n\nUna fracción **a/b** dice: cortamos en **b** partes iguales y tomamos **a**.\n\n- **Denominador** (abajo): en cuántas partes cortamos.\n- **Numerador** (arriba): cuántas partes tomamos.\n",
      table: [
        ["Fracción", "Partes tomadas", "Partes totales", "Se lee"],
        ["1/2", "1", "2", "un medio"],
        ["3/4", "3", "4", "tres cuartos"],
        ["2/3", "2", "3", "dos tercios"],
      ],
    },
    {
      say: "Ahora lo difícil: sumar con distinto denominador. Un medio más un tercio. No puedo sumar pedazos de distinto tamaño, así que primero los hago del mismo tamaño. El mínimo común múltiplo de 2 y 3 es 6.",
      write:
        "\n## Sumar con distinto denominador\n\n1. Busca el MCM de los denominadores: MCM(2, 3) = **6**\n2. Convierte: 1/2 = **3/6** y 1/3 = **2/6**\n3. Suma los numeradores: 3/6 + 2/6 = **5/6**\n",
    },
    {
      say: "Mira el graficador: cada recta crece según su fracción. En x igual a uno, la verde llega justo a cinco sextos, que es la suma de las otras dos.",
      focus: "graph",
      graph: [
        { id: "a", latex: "y=\\frac{1}{2}x", color: "#7C6BF2" },
        { id: "b", latex: "y=\\frac{1}{3}x", color: "#FF8A65" },
        { id: "c", latex: "y=\\frac{5}{6}x", color: "#2FD3A3" },
        { id: "p", latex: "(1,\\frac{5}{6})", color: "#2FD3A3" },
      ],
    },
    {
      ask: "Tu turno: ¿cuánto es 1/4 + 1/2?",
      check: (a) => ["3/4", "6/8", "0.75", "0,75", "trescuartos"].some((x) => norm(a).includes(x)),
      right: "¡Exacto, tres cuartos! Convertiste un medio en dos cuartos y sumaste. Eso es todo el truco.",
      wrong: [
        {
          say: "Casi. Probemos por otro camino: un medio es lo mismo que dos cuartos, ¿lo ves en el dibujo? Entonces un cuarto más dos cuartos son tres cuartos.",
          focus: "notebook",
          clearBoard: true,
          draw: [
            { color: "#FF8A65", points: circle(0.5, 0.5, 0.3) },
            { color: "#FF8A65", points: line(0.5, 0.2, 0.5, 0.8) },
            { color: "#FF8A65", points: line(0.2, 0.5, 0.8, 0.5) },
            { color: "#2FD3A3", points: circle(0.5, 0.5, 0.15, Math.PI * 0.5, Math.PI * 2, 30) },
          ],
        },
      ],
    },
    {
      quiz: {
        question: "¿Cuál de estas fracciones es la mayor?",
        options: ["1/2", "3/4", "2/3"],
        correctIndex: 1,
        explanation: "Con denominador 12: 1/2 = 6/12, 2/3 = 8/12 y 3/4 = 9/12. La mayor es 3/4.",
      },
      right: "¡Correcto! Tres cuartos es la mayor: comparamos llevándolas al mismo denominador.",
      wrong: "No te preocupes. Comparemos con denominador doce: seis, ocho y nueve doceavos. Gana tres cuartos.",
    },
    {
      say: "Muy buen trabajo. Te dejo el resumen y tres ejercicios para practicar. Cuando quieras, termina la clase con el botón rojo.",
      focus: "doc",
      write:
        "\n## Resumen\n\n- Fracción = partes que tomo / partes en que corté.\n- Para sumar con distinto denominador: **MCM → convertir → sumar numeradores**.\n\n## Para practicar\n\n1. 2/3 + 1/4\n2. 3/5 + 1/2\n3. 1/6 + 2/3\n",
    },
  ];
}

function ecuaciones(student: string): ScriptStep[] {
  return [
    {
      say: `¡Hola ${student}! Hoy vamos a despejar ecuaciones como si fueran una balanza. Lo que hagas a un lado, lo haces al otro.`,
      focus: "doc",
      write: "# Ecuaciones lineales\n\n",
    },
    {
      ask: "Para empezar: si x + 5 = 9, ¿cuánto vale x?",
      check: (a) => /\b4\b/.test(a),
      right: "¡Bien! Le quitaste 5 a los dos lados. Esa es la idea central.",
      wrong: [{ say: "Tranqui. Piensa: ¿qué número sumado a 5 da 9? Si a los dos lados le quito 5, me queda x igual a 4." }],
    },
    {
      say: "Ahora una de dos pasos: dos x más tres igual a siete. Primero quito el tres, luego divido entre dos.",
      write:
        "## Despejar paso a paso\n\n**2x + 3 = 7**\n\n1. Resto 3 a ambos lados → 2x = 4\n2. Divido entre 2 → **x = 2**\n",
      table: [
        ["Paso", "Lado izquierdo", "Lado derecho"],
        ["Inicio", "2x + 3", "7"],
        ["− 3", "2x", "4"],
        ["÷ 2", "x", "2"],
      ],
    },
    {
      say: "Y en el graficador, la solución es donde se cruzan las dos rectas: dos x más tres, y la recta horizontal siete. Se cruzan justo en x igual a dos.",
      focus: "graph",
      graph: [
        { id: "l", latex: "y=2x+3", color: "#7C6BF2" },
        { id: "r", latex: "y=7", color: "#FF8A65" },
        { id: "s", latex: "(2,7)", color: "#2FD3A3" },
      ],
    },
    {
      ask: "Tu turno: resuelve 3x − 2 = 10. ¿Cuánto vale x?",
      check: (a) => /\b4\b/.test(a),
      right: "¡Perfecto, x vale 4! Sumaste 2 y dividiste entre 3.",
      wrong: [
        {
          say: "Vamos con la balanza: primero sumo dos a los dos lados, me queda tres x igual a doce. Luego divido entre tres: x igual a cuatro. Mira cómo se cruzan.",
          focus: "graph",
          graph: [
            { id: "l", latex: "y=3x-2", color: "#7C6BF2" },
            { id: "r", latex: "y=10", color: "#FF8A65" },
            { id: "s", latex: "(4,10)", color: "#2FD3A3" },
          ],
        },
      ],
    },
    {
      quiz: {
        question: "Para resolver x − 6 = 10, ¿qué haces a los dos lados?",
        options: ["Restar 6", "Sumar 6", "Dividir entre 6"],
        correctIndex: 1,
        explanation: "Para deshacer una resta se suma: x = 10 + 6 = 16.",
      },
      right: "¡Eso! Deshaces la resta con una suma, y x vale dieciséis.",
      wrong: "Casi. Para deshacer una resta sumamos lo mismo a los dos lados: x igual a dieciséis.",
    },
    {
      say: "¡Excelente clase! Te dejo el resumen en el documento. Termina la clase cuando quieras.",
      focus: "doc",
      write:
        "\n## Resumen\n\n- La ecuación es una balanza: lo que haces a un lado, lo haces al otro.\n- Primero sumas o restas, luego multiplicas o divides.\n\n## Para practicar\n\n1. 5x + 1 = 21\n2. 4x − 7 = 9\n3. x/2 + 3 = 8\n",
    },
  ];
}

function funciones(student: string): ScriptStep[] {
  return [
    {
      say: `¡Hola ${student}! Soy Killa. Hoy hacemos que las rectas se muevan. Te muestro y luego tú me dices qué ves.`,
      focus: "graph",
      graph: [{ id: "f", latex: "y=x", color: "#7C6BF2" }],
    },
    {
      say: "Esta es la recta más simple: y igual a x. Ahora le cambio la pendiente a dos. ¿Ves que sube más rápido? La pendiente dice cuánto sube y por cada paso en x.",
      graph: [{ id: "f2", latex: "y=2x", color: "#FF8A65" }],
    },
    {
      say: "Y si le sumo uno, la recta entera sube un piso: ese es el intercepto, donde corta al eje y.",
      graph: [{ id: "f3", latex: "y=2x+1", color: "#2FD3A3" }],
    },
    {
      say: "Lo anoto con una tabla de valores para que lo veas con números.",
      focus: "doc",
      write:
        "# Funciones lineales\n\n**y = m·x + b**\n\n- **m** = pendiente: cuánto sube *y* cuando *x* avanza 1.\n- **b** = intercepto: dónde corta al eje *y*.\n",
      table: [
        ["x", "y = 2x + 1"],
        ["0", "1"],
        ["1", "3"],
        ["2", "5"],
      ],
    },
    {
      ask: "Tu turno: ¿cuál es la pendiente de y = 3x − 2?",
      check: (a) => /\b3\b|tres/.test(a.toLowerCase()),
      right: "¡Sí, tres! El número que acompaña a la x siempre es la pendiente.",
      wrong: [
        {
          say: "Casi. Fíjate en el número pegado a la x: es tres. Mira, por cada paso a la derecha, sube tres.",
          focus: "graph",
          graphRemove: ["f", "f2"],
          graph: [{ id: "f4", latex: "y=3x-2", color: "#F06EAA" }],
        },
      ],
    },
    {
      quiz: {
        question: "¿Qué pasa con la recta y = 2x + 5 si cambias el 5 por un 1?",
        options: ["Sube más rápido", "Baja sin girar", "Se vuelve horizontal"],
        correctIndex: 1,
        explanation: "Cambiar b mueve la recta hacia arriba o abajo sin cambiar su inclinación.",
      },
      right: "¡Muy bien! Solo cambia el intercepto, la inclinación es la misma.",
      wrong: "Casi. El número suelto solo mueve la recta de lugar; la pendiente sigue siendo dos.",
    },
    {
      say: "¡Gran trabajo! El resumen ya está en el documento. Termina la clase cuando quieras.",
      focus: "doc",
      write:
        "\n## Resumen\n\n- Pendiente positiva: sube. Negativa: baja.\n- Si cambias **b**, la recta se mueve arriba o abajo sin girar.\n\n## Para practicar\n\n1. Grafica y = −x + 4\n2. ¿Dónde corta y = 2x − 6 al eje x?\n",
    },
  ];
}

function porcentajes(student: string): ScriptStep[] {
  return [
    {
      say: `¡Hola ${student}! Los porcentajes están en todas partes: descuentos, notas, el celular. Vamos a dominarlos.`,
      focus: "doc",
      write: "# Porcentajes\n\n**x% = x de cada 100**\n\n",
    },
    {
      ask: "Si tienes 100 caramelos y regalas el 15%, ¿cuántos regalas?",
      check: (a) => /\b15\b|quince/.test(a.toLowerCase()),
      right: "¡Eso! De cada cien, quince. Fácil cuando el total es cien.",
      wrong: [{ say: "Por cien es directo: el quince por ciento de cien es quince. Ahora veamos cuando no es cien." }],
    },
    {
      say: "Para un descuento del quince por ciento en algo que cuesta ochenta, multiplico ochenta por quince centésimos. Me da doce. Entonces pago sesenta y ocho.",
      write: "## Calcular un descuento\n\n1. 15% de 80 = 80 × 0,15 = **12**\n2. Precio final = 80 − 12 = **68**\n\n> Atajo: pagar con 15% de descuento es pagar el **85%**: 80 × 0,85 = 68\n",
      table: [
        ["Porcentaje", "Decimal", "De 80"],
        ["10%", "0,10", "8"],
        ["15%", "0,15", "12"],
        ["50%", "0,50", "40"],
      ],
    },
    {
      say: "En el graficador, la recta muestra cuánto descuento hay para cada precio. Cuando el precio es ochenta, el descuento es doce.",
      focus: "graph",
      graph: [
        { id: "d", latex: "y=0.15x", color: "#7C6BF2" },
        { id: "p", latex: "(80,12)", color: "#2FD3A3" },
      ],
    },
    {
      ask: "Tu turno: ¿cuánto es el 20% de 50?",
      check: (a) => /\b10\b|diez/.test(a.toLowerCase()),
      right: "¡Diez, exacto! Cincuenta por cero coma dos.",
      wrong: [{ say: "Otro camino: el diez por ciento de cincuenta es cinco, solo corro la coma. El veinte es el doble: diez." }],
    },
    {
      quiz: {
        question: "Un polo cuesta 60 soles y tiene 50% de descuento. ¿Cuánto pagas?",
        options: ["20 soles", "30 soles", "50 soles"],
        correctIndex: 1,
        explanation: "El 50% es la mitad: 60 ÷ 2 = 30 soles.",
      },
      right: "¡Correcto, treinta soles! La mitad de sesenta.",
      wrong: "Casi. El cincuenta por ciento es la mitad de sesenta, o sea treinta soles.",
    },
    {
      say: "¡Muy bien! Te dejé el resumen. Termina la clase cuando quieras.",
      focus: "doc",
      write: "\n## Para practicar\n\n1. 25% de 120\n2. Un polo de 60 con 30% de descuento: ¿cuánto pagas?\n",
    },
  ];
}

function generic(student: string, topic: string): ScriptStep[] {
  return [
    {
      say: `¡Hola ${student}! Hoy vemos ${topic}. Primero quiero entender qué ya sabes, así no repetimos lo que dominas.`,
      focus: "doc",
      write: `# ${topic}\n\n`,
    },
    {
      ask: `¿Qué es lo que más te cuesta de ${topic}?`,
      right: "Gracias, con eso armo la clase a tu medida.",
      wrong: [],
    },
    {
      say: "Vamos a ordenar las ideas en un esquema. Primero el concepto, luego un ejemplo, y al final tu duda.",
      write: "## Esquema\n\n1. **Idea central**: lo que tienes que poder explicar con tus palabras.\n2. **Ejemplo resuelto** paso a paso.\n3. **Error típico** y cómo evitarlo.\n",
      table: [
        ["Parte", "Qué hacemos", "Listo"],
        ["Concepto", "Lo explico con un ejemplo cotidiano", "✅"],
        ["Práctica", "Resuelves uno conmigo", "⏳"],
        ["Repaso", "Resumen y ejercicios", "⏳"],
      ],
    },
    {
      say: "Cuando algo tiene relación entre dos cantidades, ayuda verlo. Te dejo un ejemplo en el graficador para que juegues.",
      focus: "graph",
      graph: [{ id: "g", latex: "y=\\sin(x)", color: "#7C6BF2" }],
    },
    {
      ask: "¿Puedes explicarme con tus palabras la idea central que vimos?",
      right: "¡Muy bien! Explicarlo es la mejor prueba de que lo entendiste.",
      wrong: [],
    },
    {
      say: "Excelente. Te dejé el resumen y qué practicar. Termina la clase cuando quieras.",
      focus: "doc",
      write: `\n## Resumen\n\n- Repasa el esquema de arriba.\n- Practica tres ejercicios de ${topic} esta semana.\n`,
    },
  ];
}

const fold = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Elige el guion por nombre de tema (funciona con los temas del mock y con los de la base). */
export function scriptFor(topicId: string, topicName: string, studentName: string): ScriptStep[] {
  const t = fold(`${topicId} ${topicName}`);
  if (t.includes("fraccion")) return fracciones(studentName);
  if (t.includes("ecuacion")) return ecuaciones(studentName);
  if (/funcion|trigonometr|cinematica|derivada/.test(t)) return funciones(studentName);
  if (/porcentaje|proporcion/.test(t)) return porcentajes(studentName);
  return generic(studentName, topicName);
}
