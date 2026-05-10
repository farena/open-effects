# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

npm workspaces monorepo (`apps/*`, `packages/*`). Three workspaces:

- **`apps/web`** — Next.js 15 (App Router) full-stack app. Houses the editor UI, REST API, render endpoint, Prisma schema, and OpenAPI spec. The product surface lives entirely here.
- **`packages/runtime`** — Standalone Remotion package exporting `OpenEffectsComposition`, which reads a `Project` via `inputProps`. The **same composition is consumed by `<Player>` for live preview and by `@remotion/renderer` for MP4 output** — keep these paths symmetrical.
- **`packages/shared-types`** — Zod schemas (`Project`, `Scene`, `Layer`, `Keyframe`, `AudioTrack`, `VolumeKeyframe`, `Easing`, `Transition`, `BusinessContext`, `VideoScript`) and inferred TS types. Single source of truth for the project JSON shape; both Prisma and the runtime align to these schemas.

`apps/web/.env` is a symlink to the repo-root `.env` so Prisma and Next pick up identical credentials. `apps/web` `transpilePackages` both internal packages and lists `@remotion/bundler`/`@remotion/renderer`/`@rspack/*` as `serverExternalPackages`.

## Common commands

Run from the repo root unless noted.

```sh
npm run dev                       # next dev on :3000 (alias for `start`)
npm test                          # vitest run across all workspaces
npm run build                     # next build + workspace builds where present
npm run db:migrate                # prisma migrate dev (apps/web)
npm run db:generate               # prisma generate (apps/web)
npm run db:studio                 # prisma studio
npm run lint -w apps/web          # eslint v9 flat config (next/core-web-vitals + next/typescript)
npm run typecheck -w apps/web     # tsc --noEmit
npm run docs:lint -w apps/web     # redocly lint openapi.yaml
npm run docs:build -w apps/web    # build docs/api/redoc.html from openapi.yaml
npm run studio -w packages/runtime  # Remotion Studio against fixtures
npm test -w apps/web              # only the web suite
npm test -w packages/runtime      # only the runtime suite
# Single test file:
npm test -w apps/web -- tests/api/projects.test.ts
# Single test by name (vitest -t):
npm test -w apps/web -- -t "creates a project"
```

## Database setup (matters for tests)

- MariaDB 11 must be running on `localhost:3306`. There is **no Docker Compose** — the DB is preprovisioned on the dev machine.
- Two databases: dev (`.env`, default `open_effects`) and isolated test (`.env.test`, default `open_effects_test`). Both are required if you run tests.
- `apps/web/tests/setup-env.ts` loads `.env.test` from the repo root and **overrides** `DATABASE_URL`. If `.env.test` is missing the suite throws immediately — copy `.env.test.example` first and run `db:migrate` against the test DB.
- Prisma uses **provider `mysql` + `@prisma/adapter-mariadb` driver adapter** (`apps/web/src/lib/db.ts`), not the native MySQL driver. Generated client output is `apps/web/src/generated/prisma` (gitignored, `moduleFormat: "cjs"`); import via the alias `@/generated/prisma/client`.
- Vitest is configured with `fileParallelism: false` in `apps/web/vitest.config.ts` because all suites share a single MariaDB and parallel runs cause FK violations on the same `Project` rows. Don't flip this on without changing the isolation strategy.

## Architecture: how state flows

**Editing → DB (autosave path)**

1. `apps/web/src/editor/store.ts` — Zustand store wrapped with **Immer** (mutating reducers) and **Zundo** (undo/redo, partialized to `state.project` only, limit 100). The store holds the entire `Project` plus selection / playback / save state.
2. `useAutosave` (`apps/web/src/editor/useAutosave.ts`) subscribes to project mutations, debounces 5s, and PATCHes the **whole project** to `/api/projects/:id`. It explicitly skips the empty-store → hydrated-project transition so page loads don't re-PATCH unchanged data.
3. `PATCH /api/projects/[id]/route.ts` validates with `ProjectSchema` and calls `persistProjectJson` (`apps/web/src/lib/persistence/persistProjectJson.ts`). The persistence strategy is **delete-all-scenes-then-recreate inside one transaction** — acceptable because autosave is debounced and the app is single-user. Cascades take care of layers / keyframes / audioTracks / volumeKeyframes.
4. Nullable JSON columns (`Scene.transitionIn`, `AudioTrack.eq`) must be written as `Prisma.JsonNull` (not JS `null`) when clearing them — there is no DB default and the DELETE+INSERT cycle would otherwise leave them undefined.

**DB → Editor / runtime**

- `toProjectJson(projectId)` (`apps/web/src/lib/persistence/toProjectJson.ts`) hydrates the relational graph and shapes it to the Zod `Project` schema. This is the canonical adapter; both the editor (`GET /api/projects/:id`) and the render pipeline use it.

**Preview ↔ render parity**

- `OpenEffectsComposition` is the single composition. The editor mounts it inside `@remotion/player` with `inputProps: { project }`; the render endpoint (`POST /api/render/[projectId]`) bundles it with `@remotion/bundler` and runs `@remotion/renderer`. Anything that breaks parity (e.g. EQ — applied at render only) must be documented in the editor UI.
- `buildRenderProject` (`apps/web/src/lib/render/buildRenderProject.ts`) materializes audio assets before render: it runs `processEq` (FFmpeg, cached by `SHA256(assetSha:eqParams)` under `apps/web/.cache/audio/`, bypassed when all gains are 0) and rewrites `assetPath` to absolute URLs (`RENDER_BASE_URL`, default `http://localhost:3000`) — Remotion needs URLs, not relative paths.

**Layer sandboxing (security-relevant)**

Layers are arbitrary user HTML+CSS. The runtime defends the editor chrome via three layers (in `packages/runtime/src/lib/`):
1. **DOMPurify** sanitizes HTML before injection.
2. **`scopeCss`** prefixes every selector with `[data-layer-id="..."]`.
3. The layer container uses `contain: strict`.

Don't bypass any of these when adding layer features.

**Animation engine**

- Animatable property whitelist + metadata lives in `packages/runtime/src/keyframes/propertyRegistry.ts`, exported as `ANIMATABLE_KEYS` / `PROPERTIES`. The store rejects keyframes for unknown properties (custom properties go through `isCustomProperty`).
- `computeStylesAtFrame(keyframes, frame)` interpolates per-property — numeric / color (rgba) / compound transform / custom values handled separately.
- Spring easing uses Remotion `spring()` with `durationInFrames = kfB.frame - kfA.frame` and is remapped onto a 0→1 interpolator between the two keyframe values.

## Conventions

- **TypeScript strict** everywhere (root `tsconfig.base.json`). Path alias `@/*` → `apps/web/src/*`.
- **Tests:** Vitest 3, suites live under `tests/` in each workspace (not co-located). API tests hit a real DB — see the database setup section above. Performance benches live under `apps/web/tests/perf/`.
- **API contract:** `apps/web/openapi.yaml` is the source of truth for the HTTP API. The `open-effects-video` skill (in `.claude/skills/`) drives the editor via this API and is invokable for any "add scene / animate layer / render project" request.
- **Roadmap:** `docs/plans/00-master-plan.md` is the master plan; per-stage detailed plans (`01-*.md` … `14-*.md`) live alongside it. Stages 1–9 are the v1 product; 10–14 are follow-on improvements (audio overhaul, UI polish, API docs, etc.).
- **ADRs:** `docs/decisions/` holds short architecture decision records (color/transform interpolation strategy, EQ cache strategy, render asset URL handling).
