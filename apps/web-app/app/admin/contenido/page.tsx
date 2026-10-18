"use client";

import { useState } from "react";
import { PageHeader } from "@/components/admin/admin-ui";
import { TopicsSection } from "@/components/admin/content-topics";
import { TutorsSection } from "@/components/admin/content-tutors";
import { ShopSection } from "@/components/admin/content-shop";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "temas", label: "Temas" },
  { id: "tutores", label: "Tutores IA" },
  { id: "tienda", label: "Tienda" },
] as const;

/** Contenido: temas, tutores IA y artículos de la tienda. */
export default function AdminContentPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("temas");
  return (
    <div className="space-y-5">
      <PageHeader title="Contenido" subtitle="Ordena los temas, administra a los tutores IA y el catálogo de la tienda." />
      <div role="tablist" aria-label="Contenido" className="flex gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("flex-1 rounded-xl py-2 text-sm font-extrabold", tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "temas" && <TopicsSection />}
      {tab === "tutores" && <TutorsSection />}
      {tab === "tienda" && <ShopSection />}
    </div>
  );
}
