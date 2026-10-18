// Tipos del panel de administración (/admin y /api/admin/*).

import type { UUID } from "@/lib/types";


export interface AuditRow {
  id: number;
  admin_id: UUID | null;
  admin_name: string | null;
  action: string;
  target: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

