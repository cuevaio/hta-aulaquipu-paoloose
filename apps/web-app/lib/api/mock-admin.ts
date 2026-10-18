// Panel de administración en modo mock: mismas reglas que lib/server/admin-handlers.ts
// y las funciones SQL de 003_admin.sql, sobre el estado local del mock.

import type { AdminApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import type { DbState } from "@/lib/api/seed";
import type { LedgerKind, UUID } from "@/lib/types";

export interface MockHelpers {
  read<T>(fn: (s: DbState) => T): Promise<T>;
  write<T>(fn: (s: DbState) => T): Promise<T>;
  balanceOf(s: DbState, id: UUID): number;
  addLedger(
    s: DbState,
    entry: { kind: LedgerKind; amount: number; from: UUID | null; to: UUID | null; sessionId?: UUID | null; note?: string },
  ): void;
  uid(prefix: string): string;
  now(): string;
}

export const isMockAdmin = (s: DbState, userId: UUID) => s.admins.includes(userId);

function requireAdmin(s: DbState, userId: UUID) {
  if (!isMockAdmin(s, userId)) throw new ApiError("Solo administradores.", "forbidden");
}

export function buildMockAdmin(h: MockHelpers): AdminApi {


  return {
    me: (u) => h.read((s) => ({ isAdmin: isMockAdmin(s, u) })),

    audit: (u) =>
      h.read((s) => {
        requireAdmin(s, u);
        return [...s.admin_audit].sort((a, b) => b.id - a.id).slice(0, 100);
      }),

  };
}
