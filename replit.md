# Blue Media

A Filipino-focused social media platform with real-time chat, posts with reactions, friend system, and admin panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxy at /api and /socket.io)
- `pnpm --filter @workspace/blue-media run dev` — run the frontend (port 23694, proxy at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.io (real-time)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle DB schema (users, sessions, posts, friendships, conversations, notifications)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/index.ts` — HTTP + Socket.io server entry
- `artifacts/blue-media/src/pages/` — React page components
- `artifacts/blue-media/src/components/layout.tsx` — top navigation bar
- `artifacts/api-server/uploads/` — uploaded media files (served at /api/uploads/:filename)

## Architecture decisions

- Auth uses random hex tokens stored in `sessions` table; token sent as `Authorization: Bearer <token>` header and stored in localStorage.
- 4-digit PIN hashed with bcrypt (rounds=10).
- Socket.io served at `/socket.io` path on the same port as the API.
- File uploads via multer to `artifacts/api-server/uploads/`; served as static files at `/api/uploads/`.
- Admin user auto-detected by email match at registration (startcopediwznaga@gmail.com → isAdmin=true).
- Circular import between `routes/friends.ts` and `index.ts` (io export) is safe at runtime since Node.js handles circular ES module refs after full init.

## Product

- Email + 4-digit PIN authentication (no passwords)
- Home feed with posts, images, heart/cry/laugh/angry reactions, comments
- WhatsApp-style real-time chat (direct + group) via Socket.io
- Friend system: add / accept / reject requests with real-time notifications
- User profiles with avatar + cover photo upload
- Notification center (friend requests, reactions, comments, messages)
- Admin panel (accessible to admin@bluemedia only)
- Distinct blue brand identity

## Admin account

- Email: startcopediwznaga@gmail.com
- PIN: 1989

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` before running leaf artifact typechecks — lib declarations must be built first.
- After changing DB schema, run `pnpm --filter @workspace/db run push` to apply migrations.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks.
- Do NOT run `pnpm dev` at the workspace root — use individual workflows.
- DB package exports: `db`, `pool`, and all table constants (e.g. `usersTable`, `sessionsTable`).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
