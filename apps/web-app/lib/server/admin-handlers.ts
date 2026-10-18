// Endpoints del panel de administración (/api/admin/*). route.ts ya exigió sesión + admin;
// cada mutación llama a audit() (o lo hace la función SQL, como admin_grant).

import { db, must, rpc } from "@/lib/server/core";
import { profilesById } from "@/lib/server/data";
import type {
  AdminMetrics,
  AuditRow,
} from "@/lib/admin-types";

// ---------- métricas y auditoría ----------

export const metrics = () => rpc<AdminMetrics>("admin_metrics", {});

export async function auditLog(): Promise<AuditRow[]> {
  const rows = await must<Omit<AuditRow, "admin_name">[]>(
    db().from("admin_audit").select("*").order("id", { ascending: false }).limit(100),
  );
  const people = await profilesById(rows.map((r) => r.admin_id ?? ""));
  return rows.map((r) => ({ ...r, admin_name: r.admin_id ? people.get(r.admin_id)?.display_name ?? null : null }));
}

