# Plan 13 — API Documentation for Programmatic Video Creation

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read `00-master-plan.md`, `03-crud-editor-base.md`, `05-audio-basic.md`, `08-mp4-render.md` first. This plan is post-v1 (consumed from `10-following-steps.md`, item 7). It documents the **existing** REST API of `apps/web` so an external agent (or another developer) can drive open-effects programmatically — upload assets, create/patch projects with full ProjectJson, trigger renders, follow progress, and download MP4s. **No new endpoints are added** in this plan; if a one-shot agent endpoint is desired, it will be a separate follow-up plan.

**Goal:** A developer or agent reading the docs can, end-to-end, (a) authenticate (no auth in v1 — documented as such), (b) upload an audio + image asset, (c) create a project, (d) PATCH a full ProjectJson defining scenes/layers/keyframes/audio, (e) POST to start a render, (f) follow SSE progress, (g) download the produced MP4. The docs ship as a static OpenAPI 3.1 spec + a Markdown "Programmatic guide" with copy-pasteable curl + a worked end-to-end example using a small ProjectJson fixture.

**Architecture:** OpenAPI lives at `apps/web/openapi.yaml` (single source of truth). A Markdown guide at `docs/api/programmatic-guide.md` walks through the worked example with curl. The OpenAPI spec is generated **manually** from the existing route handlers + Zod schemas (no automatic introspection — the routes are simple and the Zod schemas in `packages/shared-types` already document the JSON contract). To make the docs browsable in-repo without a server, we lint the OpenAPI with `@redocly/cli` (already a common standard) and use the static `redoc-cli` to render an HTML preview at `docs/api/redoc.html` (committed). Optionally, we expose the raw YAML at `/api/openapi.yaml` (Next.js route returning the file) so an agent can fetch the schema at runtime.

**Tech Stack additions:** `@redocly/cli` (devDependency, used for lint + static HTML build). No runtime deps.

---

## Acceptance criteria

1. **OpenAPI spec.** `apps/web/openapi.yaml` is a valid OpenAPI 3.1 document covering every implemented endpoint:
   - `GET /api/health`
   - `GET /api/projects`, `POST /api/projects`
   - `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`
   - `GET /api/projects/:id/renders/:filename`, `DELETE /api/projects/:id/renders/:filename`
   - `GET /api/assets`, `POST /api/assets`, `DELETE /api/assets/:id`
   - `GET /api/components`, `POST /api/components`, `DELETE /api/components/:id`
   - `POST /api/render/:projectId`
   - `GET /api/render/:projectId/:renderId/events` (SSE)
   - `GET /api/render/eq-asset/:filename`
2. **Schema components.** Zod schemas (`Project`, `Scene`, `Layer`, `Keyframe`, `AudioTrack`, `VolumeKeyframe`, `Eq`, `Transition`, `Easing`) are translated to OpenAPI `components.schemas`. The translation is documented as a manual mapping in the spec's `info.description` (acceptable for v1; auto-generation deferred).
3. **Programmatic guide.** `docs/api/programmatic-guide.md` walks through a fully working scenario: upload one audio + one image, create project, PATCH a 2-scene ProjectJson, render, poll SSE, download MP4 — every step with a copyable `curl` invocation and the expected response shape.
4. **Worked example fixture.** `docs/api/examples/minimal-project.json` is a valid `ProjectSchema` that can be PATCHed in step (d) of the guide. It MUST `Zod.safeParse` successfully against the current schema (covered by a unit test).
5. **OpenAPI exposed at `/api/openapi.yaml`.** A Next.js route reads the YAML from disk and returns it with `content-type: application/yaml`. This lets agents discover the schema at runtime.
6. **Lint.** `npx redocly lint apps/web/openapi.yaml` passes.
7. **Static HTML preview.** `docs/api/redoc.html` is generated from the spec and committed for offline browsing.

---

## File structure

```
apps/web/
├── openapi.yaml                                    # NEW: source of truth
├── package.json                                    # MODIFY: add redocly devDep + npm scripts
├── src/
│   └── app/api/openapi.yaml/
│       └── route.ts                                # NEW: Next route serving the spec
└── tests/
    └── docs/
        └── minimal-project-fixture.test.ts        # NEW: validate fixture against ProjectSchema

docs/
└── api/
    ├── programmatic-guide.md                       # NEW
    ├── redoc.html                                  # NEW (generated)
    └── examples/
        ├── minimal-project.json                    # NEW: small valid ProjectJson
        └── curl-cookbook.md                        # NEW: per-endpoint snippets
```

---

## Acceptance criteria → tasks map

| AC | Tasks |
|---|---|
| 1. OpenAPI covers every endpoint | T1, T2, T3 |
| 2. Schemas translated | T2 |
| 3. Programmatic guide | T5 |
| 4. Worked-example fixture validated | T6 |
| 5. `/api/openapi.yaml` route | T7 |
| 6. Redocly lint passes | T4 |
| 7. Static HTML preview generated | T8 |

---

## Task list (execution order)

### Task 1: Inventory existing routes

**Files:**
- (research only — no commits)

- [ ] **Step 1:** Walk `apps/web/src/app/api/**/route.ts` and record for each handler:
  - HTTP method + path
  - Request body schema (Zod) if any
  - Path/query params
  - Response shape (success + error variants observed in the code)
  - Status codes used
- [ ] **Step 2:** Cross-reference against `packages/shared-types/src/schemas/*.ts` to identify which schemas describe the wire payloads (e.g., `ProjectSchema` for PATCH /api/projects/:id; `AssetSchema` for GET /api/assets responses).
- [ ] **Step 3:** Write the inventory as a top-of-file comment in `openapi.yaml` (line-by-line list of every endpoint + its source file) for traceability. Useful when re-generating docs after route additions.

---

### Task 2: Author `apps/web/openapi.yaml` — schemas + paths

**Files:**
- Create: `apps/web/openapi.yaml`

- [ ] **Step 1:** Header block:
  ```yaml
  openapi: 3.1.0
  info:
    title: open-effects API
    version: 1.0.0
    description: |
      REST API for open-effects, a visual video editor over Remotion. Use this
      API to upload assets, create and patch projects (the editor's source of
      truth is a ProjectJson document), trigger MP4 renders, follow render
      progress via SSE, and download the produced files.

      Authentication: none in v1 (single-user local deployment).

      All requests/responses are JSON unless noted (asset upload uses
      multipart/form-data; SSE responses use text/event-stream; OpenAPI spec
      itself is application/yaml).
  servers:
    - url: http://localhost:3000
      description: Local dev
  ```
- [ ] **Step 2:** `components.schemas` — translate each Zod schema:
  - `Project`, `Scene`, `Layer`, `Keyframe`, `VolumeKeyframe`, `Easing`, `AudioTrack`, `Asset`, `Eq`, `Transition`, `SavedComponent`.
  - For unions (e.g., `Easing` is `linear | ease-in | ease-out | ease-in-out | cubic-bezier | spring`), use `oneOf` with discriminator `type`.
  - Mirror Zod constraints: `width`/`height` integer ≥ 1, `fps` enum `[24, 30, 60]`, `volume` number `0..1`, etc.
- [ ] **Step 3:** Define `components.responses` for shared error shape `{ error: string | object }` (Zod `safeParse` produces `flatten()` for 400 responses).
- [ ] **Step 4:** Author each path under `paths:`. Group by tag: `Health`, `Projects`, `Assets`, `Components`, `Renders`. For each operation include `operationId`, `summary`, request schema (`requestBody.content`), response schemas per status. Use `$ref` extensively to avoid duplication.
- [ ] **Step 5:** SSE endpoint: document `text/event-stream` content type with example event payload (`event: progress\ndata: {"percent": 42}\n\n`) — OpenAPI doesn't formally model SSE, but documenting the content type and example is the convention.
- [ ] **Step 6:** Commit: `docs(api): openapi spec — projects + assets`.

---

### Task 3: Add `examples` to every operation

**Files:**
- Modify: `apps/web/openapi.yaml`

- [ ] **Step 1:** For each request body and response, add at least one inline `example` (or `examples` map for multiple). Examples must be valid against their schema — agent users will copy these directly.
- [ ] **Step 2:** For `POST /api/projects` request, the example is the small body that creates a project (just `name`/`width`/`height`/`fps`).
- [ ] **Step 3:** For `PATCH /api/projects/:id` request, link to the external file via `examples.minimal: $ref: ./../docs/api/examples/minimal-project.json` if the runtime supports it; otherwise inline a trimmed inline copy and reference the full file in description text.
- [ ] **Step 4:** Commit: `docs(api): add examples to every endpoint`.

---

### Task 4: Lint OpenAPI with Redocly

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1:** `npm install -D @redocly/cli -w apps/web`.
- [ ] **Step 2:** Add scripts:
  ```json
  "scripts": {
    "docs:lint": "redocly lint openapi.yaml",
    "docs:build": "redocly build-docs openapi.yaml -o ../../docs/api/redoc.html"
  }
  ```
- [ ] **Step 3:** Run `npm run docs:lint -w apps/web` and fix any reported issues until clean. Common fixes: missing `operationId`s, missing `description`s, missing tags definitions.
- [ ] **Step 4:** Commit: `chore(docs): redocly lint setup + initial pass`.

---

### Task 5: Programmatic guide markdown

**Files:**
- Create: `docs/api/programmatic-guide.md`, `docs/api/examples/curl-cookbook.md`

- [ ] **Step 1:** `programmatic-guide.md` structure:
  ```
  # Driving open-effects programmatically

  ## TL;DR
  Five HTTP calls produce an MP4 from a JSON description of your video.

  ## Prerequisites
  - A running open-effects dev server at http://localhost:3000
  - FFmpeg installed locally (used at render time)

  ## Step 1 — Upload assets
  POST /api/assets (multipart). Save returned `id` and `path`.

  ## Step 2 — Create a project
  POST /api/projects with name + dimensions + fps.

  ## Step 3 — Define your video
  PATCH /api/projects/:id with a full ProjectJson. See `examples/minimal-project.json`.

  ## Step 4 — Trigger a render
  POST /api/render/:projectId. Returns a renderId.

  ## Step 5 — Follow progress
  Open an SSE connection to /api/render/:projectId/:renderId/events.
  Each `progress` event carries a 0..100 percent value. A `done` event carries the output path.

  ## Step 6 — Download the MP4
  GET /api/projects/:id/renders/:filename.

  ## Worked example
  (paste the full curl sequence using the minimal-project fixture)

  ## Schema reference
  See openapi.yaml or the rendered docs at /docs/api/redoc.html.
  Schemas are also fetchable at /api/openapi.yaml.

  ## Limits & gotchas
  - Asset upload max size: 200 MB
  - EQ is applied only at render (preview is raw)
  - Single-user, no auth — do not expose the dev server publicly
  ```
- [ ] **Step 2:** `curl-cookbook.md`: one section per endpoint with curl invocation + a representative response body (truncated where appropriate).
- [ ] **Step 3:** Commit: `docs(api): programmatic guide + curl cookbook`.

---

### Task 6: Worked-example fixture + validation test (TDD)

**Files:**
- Create: `docs/api/examples/minimal-project.json`, `apps/web/tests/docs/minimal-project-fixture.test.ts`

- [ ] **Step 1:** Failing test:
  ```ts
  import { describe, it, expect } from "vitest";
  import { ProjectSchema } from "@open-effects/shared-types";
  import fixture from "../../../../docs/api/examples/minimal-project.json";

  describe("docs minimal-project fixture", () => {
    it("conforms to ProjectSchema", () => {
      const result = ProjectSchema.safeParse(fixture);
      expect(result.success).toBe(true);
      if (!result.success) console.error(result.error.flatten());
    });
  });
  ```
- [ ] **Step 2:** Author `minimal-project.json`:
  - 1 project, 30 fps, 1280×720, 2 scenes (60 frames each).
  - Scene 1: 1 layer with `opacity` keyframe 0→1 from frame 0 to 30 (linear).
  - Scene 2: 1 layer with HTML/CSS for "Thanks for watching".
  - 1 audio track in scene 1 with `volumeKeyframes` for fade-in.
- [ ] **Step 3:** Iterate until test passes (Zod errors point to the offending field paths).
- [ ] **Step 4:** Commit: `feat(docs): minimal-project fixture validated by Zod`.

---

### Task 7: Serve `/api/openapi.yaml` via Next.js

**Files:**
- Create: `apps/web/src/app/api/openapi.yaml/route.ts`

- [ ] **Step 1:** Implement:
  ```ts
  import { NextResponse } from "next/server";
  import { readFile } from "node:fs/promises";
  import path from "node:path";

  export async function GET() {
    const file = path.resolve(process.cwd(), "openapi.yaml");
    const yaml = await readFile(file, "utf8");
    return new NextResponse(yaml, {
      status: 200,
      headers: { "content-type": "application/yaml; charset=utf-8" },
    });
  }
  ```
- [ ] **Step 2:** Manual: `curl -i http://localhost:3000/api/openapi.yaml` returns `200 application/yaml` with the full spec.
- [ ] **Step 3:** Commit: `feat(api): expose /api/openapi.yaml route`.

---

### Task 8: Build static HTML preview + commit

**Files:**
- Create (generated): `docs/api/redoc.html`

- [ ] **Step 1:** Run `npm run docs:build -w apps/web`. It writes `docs/api/redoc.html` (the directory already exists from Task 5).
- [ ] **Step 2:** Open `docs/api/redoc.html` in a browser to spot-check rendering: every endpoint visible, examples render, schemas resolve.
- [ ] **Step 3:** Add `docs/api/redoc.html` to `.gitignore` ONLY if you'd rather build on demand. Default for this plan: **commit it** so the repo offers offline browsing.
- [ ] **Step 4:** Commit: `docs(api): static redoc HTML preview`.

---

### Task 9: Closure

- [ ] **Step 1:** `npm run docs:lint -w apps/web` clean.
- [ ] **Step 2:** `npm test -w apps/web --if-present` clean (fixture validation passes).
- [ ] **Step 3:** Walk the programmatic guide end-to-end with a real dev server: upload → create → patch (using the fixture) → render → SSE → download. Confirm each step works as documented.
- [ ] **Step 4:** Final commit / tag closure: `chore(docs): plan 13 closure`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| `minimal-project.json` valid against `ProjectSchema` | unit | `tests/docs/minimal-project-fixture.test.ts` |
| `redocly lint openapi.yaml` clean | lint | CI step |
| `/api/openapi.yaml` returns 200 + yaml content type | manual | curl |
| End-to-end programmatic walkthrough | manual | dev server + curl |

---

## Risks

| Risk | Mitigation |
|---|---|
| Manual OpenAPI authoring drifts from actual route behavior over time | Add a CI lint step (`docs:lint`); refer to inventory comment in spec. Future plan can adopt `zod-to-openapi` for auto-generation. |
| Examples become stale | Fixture (T6) is unit-validated against the live `ProjectSchema` — schema breakage breaks the test, forcing an update. Inline examples in YAML are human-maintained — call this out in `programmatic-guide.md`. |
| SSE not perfectly modeled in OpenAPI | OpenAPI 3.1 doesn't formalize SSE — document via `text/event-stream` content type + example event; agents that consume SSE can rely on the prose + sample. |
| Next.js route serving the YAML may misfire if `process.cwd()` differs in production | The path is resolved against `process.cwd()` which equals the `apps/web` working dir for the Next dev/build process; if a future deployment changes that, switch to `import.meta.url`-based resolution. Documented in route comment. |
| Redocly CLI updates change the build output | Pin a specific minor version in `package.json`; stable enough for v1. |
| Spec is large; lint/build slow | Acceptable for v1 (one developer machine); not a CI concern as docs build is a separate `npm run docs:build` script, not part of `npm test`. |
| `application/yaml` not universally accepted as a valid mime type by all consumers | Some agents prefer `text/yaml` or `text/plain`. The route can be extended to honor `Accept` header; v1 sticks with `application/yaml`. |

---

## Final task checklist

- [ ] T1 — Inventory routes
- [ ] T2 — Author OpenAPI: schemas + paths
- [ ] T3 — Add examples
- [ ] T4 — Redocly lint setup
- [ ] T5 — Programmatic guide + curl cookbook
- [ ] T6 — Fixture + validation test (TDD)
- [ ] T7 — Expose `/api/openapi.yaml`
- [ ] T8 — Static HTML preview
- [ ] T9 — Closure walkthrough

**Total tasks:** 9 · **Estimate:** 3–5 days. · **Critical risks:** spec drift over time (mitigated by fixture validation + lint in CI; consider auto-generation in a follow-up). · **Out of scope:** authentication, an agent-friendly one-shot endpoint, rate limiting — flagged as candidates for a future plan.
