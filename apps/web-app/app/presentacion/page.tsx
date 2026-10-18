import type { Metadata } from "next";
import { Deck } from "./deck";
import { SLIDES } from "./slides";

export const metadata: Metadata = {
  title: "Presentación de AulaQuipu",
  description: "Presentación de AulaQuipu para Hack the Andes 2026: problema, solución, demo, arquitectura y alcance.",
  openGraph: {
    title: "Presentación de AulaQuipu",
    description: "El que sabe enseña y gana. El que aprende paga y mejora.",
    type: "website",
    locale: "es_PE",
    siteName: "AulaQuipu",
  },
};

export default function PresentacionPage() {
  return <Deck slides={SLIDES} />;
}
