import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito, Fredoka } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-sans" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-display" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "AulaQuipu",
  description: "El que sabe enseña y gana, el que aprende paga y mejora. Tutorías entre alumnos con quipus.",
};

export const viewport: Viewport = {
  themeColor: "#2b2550",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-PE"
      className={cn("h-full antialiased font-sans", nunito.variable, fredoka.variable, geistMono.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
