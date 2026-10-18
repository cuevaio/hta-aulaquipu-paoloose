import type { ApiClient } from "@/lib/api/client";
import { httpApi } from "@/lib/api/http";
import { mockApi } from "@/lib/api/mock";

// Por defecto la app usa la API real (Supabase vía route handlers). "mock" = datos ficticios en el navegador.
export const API_MODE = process.env.NEXT_PUBLIC_API_MODE === "mock" ? "mock" : "http";

export const api: ApiClient = API_MODE === "http" ? httpApi : mockApi;

export { ApiError } from "@/lib/api/client";
export type * from "@/lib/api/client";
