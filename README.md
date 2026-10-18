# AulaQuipu

Tutorías entre alumnos de secundaria pagadas con **quipus** (dinero de juego): el que sabe enseña y gana, el que aprende paga y mejora. Campus 2D estilo gather, aula en vivo con LiveKit y tutores IA que hablan, escriben en el documento y grafican en Desmos.

## Arquitectura

```
Navegador ── apps/web-app (Next.js)
               ├─ páginas: login con DNI, campus 2D, paneles, aula
               └─ app/api/[...path]  ← API (§9) con cookie de sesión firmada
                     ├─ Supabase (Postgres) con la secret key: tablas + RPCs atómicas
                     └─ LiveKit: tokens de 10 min + despacho del agente
LiveKit ── backend/agents/aulaquipu-tutor (agente de voz; herramientas docWrite / graphSet)
```

- El navegador **no escribe** en la base: todo pasa por la API. La clave pública solo lee el catálogo.
- El saldo sale del ledger (`quipus_ledger`). Reservar valida el **saldo disponible** (saldo − clases reservadas aún no cobradas); se cobra al terminar la clase.

## Base de datos

- Base nueva: correr `backend/database.sql` y luego `backend/demo_seed.sql` en el editor SQL de Supabase.
- Base ya creada con la versión anterior: correr solo `backend/migrations/001_web_app.sql` (idempotente).

Cuentas de prueba: DNI `70000001` … `70000010`, contraseña `aula2026`.

## Desarrollo

```bash
cd apps/web-app
cp .env.example .env.local   # completar Supabase y LiveKit
bun install
bun dev                      # http://localhost:3000
```

Sin LiveKit configurado el aula funciona en modo local con un tutor IA simulado. Con `NEXT_PUBLIC_API_MODE=mock` toda la app corre con datos ficticios en el navegador (sin base).

Agente de voz (requiere las mismas claves de LiveKit):

```bash
cd backend/agents/aulaquipu-tutor
pnpm install
pnpm dev
```

## Qué quedó fuera

Monetización real, control parental, paneles de colegio y el browser embebido del tutor IA (ver `docs/superpowers/specs/2026-10-17-aulaquipu-design.md`).
