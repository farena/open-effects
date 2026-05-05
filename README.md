# open-effects

Visual video editor over Remotion.

See the full roadmap: [docs/plans/00-master-plan.md](docs/plans/00-master-plan.md)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | use `.nvmrc` — `nvm use` |
| npm | 10+ | bundled with Node 20 |
| MariaDB | 11 | must be running on `localhost:3306` |
| FFmpeg | any recent | only required from Stage 6 (render); install now |

---

## Quickstart

```sh
cp .env.example .env
# Edit .env if your MariaDB credentials differ from root:secret
npm install
npm run db:migrate    # applies the initial migration to your local DB
npm run dev
```

Open `http://localhost:3000`.

---

## Common scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start the Next.js dev server (port 3000) |
| `npm test` | Run all Vitest suites across workspaces |
| `npm run db:migrate` | Run Prisma migrations (`prisma migrate dev`) |
| `npm run db:generate` | Regenerate the Prisma client after schema changes |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run lint -w apps/web` | ESLint v9 flat config |
| `npm run typecheck -w apps/web` | TypeScript type-check (no emit) |

---

## Project structure

```
open-effects/
├── apps/
│   └── web/                  # Next.js 15 app (main product)
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── prisma.config.ts  # Prisma 7 config — driver adapter + output path
│       ├── src/
│       │   ├── app/          # Next.js App Router (pages, API routes)
│       │   ├── components/   # shadcn/ui + custom React components
│       │   ├── generated/    # Prisma client output (git-ignored)
│       │   └── lib/          # prisma singleton, utilities
│       ├── tests/            # Vitest suites
│       ├── eslint.config.mjs # ESLint v9 flat config
│       └── vitest.config.ts
├── packages/
│   ├── runtime/              # Remotion render engine (skeleton — Stage 2+)
│   └── shared-types/         # Cross-package TypeScript types (skeleton — Stage 2+)
├── docs/
│   └── plans/                # Stage implementation plans
├── .env.example              # Copy to .env before first run
└── package.json              # npm workspaces root
```

`apps/web/.env` is a symlink to the repo-root `.env`, so Prisma and Next.js both
pick up the same credentials without duplication.

---

## Stage status

Full roadmap: [docs/plans/00-master-plan.md](docs/plans/00-master-plan.md)

| # | Stage | Status |
|---|-------|--------|
| 1 | Foundation stack — monorepo, DB, health endpoint | ✅ Done |
| 2 | Runtime engine — Remotion integration, `packages/runtime` | Planned |
| 3 | CRUD editor base — project/scene/layer management | Planned |
| 4 | Keyframe animation — property curves, easing | Planned |
| 5 | Audio — basic track support | Planned |
| 6 | Audio keyframes + EQ | Planned |
| 7 | Saved components — reusable element library | Planned |
| 8 | MP4 render — FFmpeg pipeline, export UI | Planned |
| 9 | Polish — perf, a11y, error handling, deployment | Planned |

---

## Smoke test

After `npm run dev` is running, paste these to verify Stage 1 is healthy:

```sh
curl http://localhost:3000              # → 200, contains "open-effects"
curl http://localhost:3000/projects     # → 200, contains "No projects yet"
curl http://localhost:3000/api/projects # → []
curl http://localhost:3000/api/health   # → {"status":"ok","db":"up"}
npm test                                # → 3 passing tests
```

---

## Tech stack

Next.js 15.3 + React 19 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui components,
backed by Prisma 7 (MariaDB driver adapter, client output to `src/generated/`) and
MariaDB 11. Tests run with Vitest 3. The `packages/runtime` (Remotion) and
`packages/shared-types` packages are empty skeletons that will be filled in
Stage 2 onward.
