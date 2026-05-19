# Audio Transcript → Subtitle Layer Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution and validation.

**Goal:** Add a "Transcript" button to audio tracks that sends the asset to a local Whisper container, converts the returned segments+words to project frames, and auto-generates a new `subtitle` layer whose HTML, CSS, and keyframes are produced by a linked preset. The user can edit the transcript (which preserves manual HTML/CSS/keyframe edits via a dirty flag) or click "Regenerate" to overwrite HTML+keyframes from the current transcript.

**Architecture:** A new Docker service (`onerahmet/openai-whisper-asr-webservice:latest-gpu`, `faster_whisper` engine) runs locally and exposes `POST /asr`. Next.js calls it from a new endpoint, caches the JSON result on disk by `SHA256(assetSha + model + lang)`, converts seconds→frames using `project.fps`, and streams progress via SSE following the existing `renderRegistry` pattern. The `Layer` Zod schema becomes a `discriminatedUnion("type", [HtmlLayer, SubtitleLayer])` with `"html"` as the default for backwards-compat — the runtime is untouched because subtitle layers still expose `html`/`css`/`keyframes`; those three fields are produced by a pure preset function from the transcript at creation/regeneration time. Prisma gets two new columns on `Layer` (`type` and `subtitleData` JSON).

**Tech Stack:** Docker + docker-compose v2, NVIDIA Container Toolkit (WSL2 GPU passthrough), Next.js 15 (App Router, Route Handlers, SSE), Prisma 5 with `@prisma/adapter-mariadb`, Zod 3 discriminated unions, Zustand 4 (`temporal` + `immer`), Vitest 3, lucide-react. No new npm dependencies for the web app — the only new "dependency" is the Whisper container.

---

## Scope check

In scope:
- `docker-compose.yml` + `services/whisper/README.md` documenting GPU and CPU paths.
- Zod `TranscriptSchema` and discriminated `LayerSchema`.
- Prisma migration adding `Layer.type` and `Layer.subtitleData`.
- Persistence adapter updates (`persistProjectJson` / `toProjectJson`).
- New API: `POST /api/projects/[id]/audioTracks/[trackId]/transcript` and SSE `GET /api/.../transcript/events`.
- Whisper HTTP client + disk cache (`.cache/transcripts/`).
- Three built-in subtitle presets: `subtitle-fade-segment` (default), `subtitle-karaoke-word`, `subtitle-slide-segment`.
- Store actions for creating/updating/regenerating subtitle layers and tracking the manual-override dirty flag.
- "Transcript" button in `AudioLaneRow` with inline progress state.
- Inspector variants for subtitle layers: `SubtitlePropsTab` (transcript editor à la `VideoScriptPanel`) and `SubtitlePresetsTab` (filtered preset chooser + Regenerate button + override badge).
- `openapi.yaml` documenting both new endpoints.
- Vitest unit + integration tests for schemas, presets, persistence, endpoint, and store flow.

Out of scope (deferred):
- Diarization (speaker separation) — `whisperx` engine kept as future env flip.
- SRT/VTT export.
- Re-syncing transcripts when the AudioTrack is moved/trimmed — user re-runs "Regenerate" manually.
- Auto-transcription on asset upload.
- Multi-language transcript in one layer.
- User-authored subtitle presets (CRUD).

---

## Conventions

- **Tests live under `apps/web/tests/`** (mirror source paths) and `packages/shared-types/tests/`. Vitest is configured with `fileParallelism: false` in `apps/web/vitest.config.ts` because all suites share a single MariaDB.
- **IDs**: use `newId()` from `apps/web/src/lib/ids.ts` (cuid2) for transcript segment ids, subtitle layer ids, keyframes.
- **Property strings**: subtitle presets MUST emit only keys from `packages/runtime/src/keyframes/propertyRegistry.ts` (`opacity`, `transform.translateX|Y|scale|rotate`, `color`, `background-color`, `border-radius`, `width`, `height`, `top`, `left`). Custom CSS vars (`--name`) go through `isCustomProperty` if needed.
- **Easing**: use `Easing` from `@open-effects/shared-types`. Default for subtitle presets: `{ type: "ease-in-out" }` for fade, `{ type: "linear" }` for show/hide flags.
- **Layer / Transcript types**: import from `@open-effects/shared-types`. Never re-declare.
- **Sanitization**: subtitle HTML still flows through the existing DOMPurify + `scopeCss` + `contain: strict` pipeline in `packages/runtime/src/components/Layer.tsx`. **Do not bypass** when generating HTML in presets — emit only `<div>` / `<span>` / text. No event handlers, no inline `<script>`.
- **Prisma JSON null**: when writing `subtitleData` for a non-subtitle layer, use `Prisma.JsonNull` (same pattern as `eq` and `transitionIn` in `persistProjectJson.ts`).
- **SSE**: clone the pattern from `apps/web/src/lib/render/renderRegistry.ts` — global singleton on `globalThis`, `Map<id, job>`, `subscribe(listener)`. Same `text/event-stream` Response headers.
- **Toasts**: `sonner` (already imported in `AudioLaneRow.tsx`).
- **Icons**: `Captions` from `lucide-react` for the Transcript button.
- **Lint / typecheck**: `npm run lint -w apps/web` + `npm run typecheck -w apps/web` from repo root.
- **Schemas in shared-types**: must be exported from `packages/shared-types/src/index.ts` so the web app can import them via `@open-effects/shared-types`.

---

## Authoritative type contracts (do not invent variants)

```ts
// packages/shared-types/src/schemas/transcript.ts

export const TranscriptWordSchema = z.object({
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
});

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  words: z.array(TranscriptWordSchema).default([]),
});

export const TranscriptSchema = z.object({
  language: z.string().optional(),
  model: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
  segments: z.array(TranscriptSegmentSchema),
});

export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
```

```ts
// packages/shared-types/src/schemas/layer.ts (rewritten)

const LayerCoreObject = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  name: z.string().min(1).max(100),
  html: z.string(),
  css: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  visible: z.boolean().default(true),
  keyframes: z.array(KeyframeSchema).default([]),
});

export const HtmlLayerSchema = LayerCoreObject.extend({
  type: z.literal("html").default("html"),
});

export const SubtitleLayerSchema = LayerCoreObject.extend({
  type: z.literal("subtitle"),
  subtitle: z.object({
    linkedAudioTrackId: z.string(),
    transcript: TranscriptSchema,
    presetKey: z.string(),
    manualOverride: z.boolean().default(false),
  }),
});

// IMPORTANT: discriminatedUnion + endFrame >= startFrame refine.
// We can't .refine() before the discriminator, so refine after the union.
export const LayerSchema = z
  .discriminatedUnion("type", [HtmlLayerSchema, SubtitleLayerSchema])
  .refine((l) => l.endFrame >= l.startFrame, {
    message: "endFrame must be >= startFrame",
    path: ["endFrame"],
  });

// Backwards-compat note: legacy layers without `type` must be coerced to "html"
// BEFORE parsing through the union. See Task 3 / toProjectJson updates.
```

```ts
// apps/web/src/editor/presets/subtitles/types.ts

export type SubtitlePresetContext = {
  layerStartFrame: number;     // usually 0 unless caller offsets
  fps: number;
};

export type SubtitlePresetOutput = {
  html: string;
  css: string;
  keyframes: Keyframe[];
};

export type SubtitlePreset = {
  key: string;                                // "subtitle-fade-segment"
  name: string;                                // "Fade per segment"
  description: string;
  iconKey: string;                             // lucide name
  generate(
    transcript: Transcript,
    ctx: SubtitlePresetContext,
  ): SubtitlePresetOutput;
};
```

```ts
// apps/web/src/lib/transcript/types.ts

export type TranscriptJob = {
  id: string;
  projectId: string;
  trackId: string;
  status: "queued" | "model-loading" | "transcribing" | "completed" | "error";
  progress: number; // 0..1; whisper-asr-webservice does not stream granular progress, we update at fixed checkpoints
  transcript?: Transcript;     // populated when completed
  error?: string;
  startedAt: number;
  finishedAt?: number;
};
```

```ts
// Whisper API request → our normalized transcript
// whisper-asr-webservice POST /asr?word_timestamps=true returns:
//   { text, segments: [{ id?, start, end, text, words: [{ start, end, word, probability }] }] }
// We map:
//   second*fps → frame (rounded), segment.id || newId(), word.word.trim() → text
```

---

## File structure

### New files (root / infra)

| Path | Responsibility |
|------|---------------|
| `docker-compose.yml` | Defines `whisper` service: GPU image `onerahmet/openai-whisper-asr-webservice:latest-gpu`, env `ASR_ENGINE=faster_whisper`, `ASR_MODEL=small`, `ASR_QUANTIZATION=float16`, `MODEL_IDLE_TIMEOUT=300`. Volume `whisper-models:/data/whisper`. Port 9000:9000. NVIDIA device reservation. |
| `services/whisper/README.md` | Setup: NVIDIA driver on Windows, NVIDIA Container Toolkit in WSL2, `docker compose up whisper`, verify `curl localhost:9000/docs`, switching model (`ASR_MODEL=large-v3-turbo`), CPU fallback (swap image to `latest` and remove deploy.resources), troubleshooting (first-run model download lag, port conflicts). |

### New files (`packages/shared-types`)

| Path | Responsibility |
|------|---------------|
| `packages/shared-types/src/schemas/transcript.ts` | Zod schemas: `TranscriptWordSchema`, `TranscriptSegmentSchema`, `TranscriptSchema`. Type exports. |
| `packages/shared-types/tests/transcript.test.ts` | Vitest: valid full transcript, empty segments allowed, frames are ints ≥ 0, words optional with default `[]`. |
| `packages/shared-types/tests/layer-discriminated.test.ts` | Vitest: parsing legacy layer (no `type`) coerces to `"html"`; subtitle layer round-trips through union; `endFrame >= startFrame` refine still fires on either variant. |

### Modified files (`packages/shared-types`)

| Path | Change |
|------|--------|
| `packages/shared-types/src/schemas/layer.ts` | Replace single `LayerSchema` with `LayerCoreObject` (plain `z.object`, no refine), `HtmlLayerSchema`, `SubtitleLayerSchema`, exported `LayerSchema = z.discriminatedUnion(...).refine(endFrame>=startFrame)`. Keep type exports stable: `export type Layer = z.infer<typeof LayerSchema>` plus new `HtmlLayer` and `SubtitleLayer` named types. |
| `packages/shared-types/src/index.ts` | Re-export `TranscriptSchema`, `TranscriptSegmentSchema`, `TranscriptWordSchema`, `HtmlLayerSchema`, `SubtitleLayerSchema`, and the three new TS types. |

### New files (`apps/web` — DB + persistence)

| Path | Responsibility |
|------|---------------|
| `apps/web/prisma/migrations/<timestamp>_layer_type_subtitle/migration.sql` | `ALTER TABLE Layer ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'html'; ALTER TABLE Layer ADD COLUMN subtitleData JSON NULL;` (Prisma autogenerates from `schema.prisma` edit). |

### Modified files (`apps/web` — DB + persistence)

| Path | Change |
|------|--------|
| `apps/web/prisma/schema.prisma` | `model Layer`: add `type String @default("html") @db.VarChar(20)` and `subtitleData Json?`. |
| `apps/web/src/lib/persistence/persistProjectJson.ts` | In the layer `create.layers.create.map`, add `type: l.type` and `subtitleData: l.type === "subtitle" ? (l.subtitle as Prisma.InputJsonValue) : Prisma.JsonNull`. |
| `apps/web/src/lib/persistence/toProjectJson.ts` | In `s.layers.map`, read `(l as { type?: string }).type ?? "html"` and `(l as { subtitleData?: unknown }).subtitleData` and emit either `{ ...html-shape, type: "html" }` or `{ ...html-shape, type: "subtitle", subtitle: parsed }`. The trailing `ProjectSchema.parse(project)` validates. |

### New files (`apps/web` — backend)

| Path | Responsibility |
|------|---------------|
| `apps/web/src/lib/transcript/transcriptRegistry.ts` | Global SSE state singleton, clone of `renderRegistry.ts`. Methods: `create({projectId, trackId})`, `get(id)`, `update(id, patch)`, `subscribe(id, listener)`. Listener fires on every `update`. |
| `apps/web/src/lib/transcript/whisperClient.ts` | `transcribeAudio(opts: { filePath: string; assetSha: string; model: string; language: string; fps: number; onStatus: (s: TranscriptJob["status"]) => void }): Promise<Transcript>`. (1) compute `cacheKey = sha256(assetSha + ":" + model + ":" + language)`; (2) read `apps/web/.cache/transcripts/<cacheKey>.json` if exists → parse with `TranscriptSchema` → return; (3) emit `onStatus("model-loading")`, fetch `WHISPER_URL/asr?task=transcribe&output=json&word_timestamps=true&language=<lang or "">` with multipart body (the audio file from `filePath` via `fs.createReadStream`); (4) emit `onStatus("transcribing")` once response starts; (5) map the response JSON to `Transcript` via `mapWhisperResponse(raw, fps)`; (6) write cache; (7) return. |
| `apps/web/src/lib/transcript/mapWhisperResponse.ts` | Pure mapper: `mapWhisperResponse(raw: WhisperRaw, fps: number): Transcript`. `Math.round(start * fps)` for frames, `newId()` for segments missing an id, filter out words with `word.trim() === ""`, clamp endFrame ≥ startFrame. |
| `apps/web/src/lib/transcript/cacheKey.ts` | `transcriptCacheKey(assetSha: string, model: string, language: string): string` — returns hex SHA256. Mirrors `apps/web/src/lib/audio/cacheKey.ts`. |
| `apps/web/src/app/api/projects/[id]/audioTracks/[trackId]/transcript/route.ts` | `POST` handler. Validates project + track exist, resolves audio asset disk path via `assetPath(asset.sha256, ext)` (use the same helper that `processEq` uses — see `apps/web/src/lib/audio/processEq.ts`), creates a `TranscriptJob`, kicks off `runTranscriptJob(jobId)` fire-and-forget, returns `{ jobId }` 202. Query params: `?model=small&lang=auto` (override defaults). |
| `apps/web/src/app/api/projects/[id]/audioTracks/[trackId]/transcript/events/route.ts` | `GET` handler. SSE stream subscribing to `transcriptRegistry`. Same shape as `apps/web/src/app/api/render/[projectId]/[renderId]/events/route.ts`. Query param `jobId`. |
| `apps/web/src/lib/transcript/runTranscriptJob.ts` | Orchestrator: gets job, looks up audio asset disk path, calls `whisperClient.transcribeAudio({...onStatus: (s) => transcriptRegistry.update(jobId, { status: s, progress: ... })})`, on success `transcriptRegistry.update(jobId, { status: "completed", transcript, progress: 1, finishedAt: Date.now() })`, on error sets `status: "error"`. |
| `apps/web/.cache/transcripts/.gitkeep` | Ensure the cache dir exists (gitignored otherwise). |
| `apps/web/tests/lib/transcript/mapWhisperResponse.test.ts` | Vitest: fixture of raw Whisper JSON → expected `Transcript` with correct frames at 30 / 60 fps; empty-word filter; missing segment id; words clamped. |
| `apps/web/tests/lib/transcript/whisperClient.test.ts` | Vitest with `vi.fn()` mock of `fetch` (`global.fetch`). Asserts cache hit short-circuits, cache miss writes file, status callbacks fire. Uses a tmp `.cache/transcripts/` dir. |
| `apps/web/tests/api/transcript.test.ts` | Vitest: POST returns 202 + `jobId`; SSE GET streams events ending in `completed`; whisper container is mocked at the `fetch` layer via `vi.spyOn(globalThis, "fetch")`. |

### Modified files (`apps/web` — backend)

| Path | Change |
|------|--------|
| `apps/web/.gitignore` | Add `.cache/transcripts/` (only if not already covered by an existing `.cache/` line — check first). |
| `.env.example` | Append `WHISPER_URL=http://localhost:9000`, `WHISPER_DEFAULT_MODEL=small`, `WHISPER_DEFAULT_LANG=auto`. |
| `apps/web/openapi.yaml` | Document `POST /api/projects/{id}/audioTracks/{trackId}/transcript` (request: query model/lang; response 202 `{ jobId }`) and `GET /.../transcript/events` (event-stream of `TranscriptJob`). Add `Transcript`, `TranscriptSegment`, `TranscriptWord`, `TranscriptJob`, and the discriminated `Layer` schema variants. |

### New files (`apps/web` — subtitle presets)

| Path | Responsibility |
|------|---------------|
| `apps/web/src/editor/presets/subtitles/types.ts` | `SubtitlePreset`, `SubtitlePresetContext`, `SubtitlePresetOutput`. |
| `apps/web/src/editor/presets/subtitles/registry.ts` | `SUBTITLE_PRESETS: SubtitlePreset[]` + `getSubtitlePreset(key): SubtitlePreset` (throws if unknown). Used by store regenerate. |
| `apps/web/src/editor/presets/subtitles/fade-segment.ts` | Default preset. Generates `<div class="subtitle-container">…<div class="subtitle-segment" data-i="0">{text}</div>…</div>`, base CSS (centered, sans-serif, white, text-shadow), and 2 keyframes per segment (opacity 0→1 at startFrame, 1→0 at endFrame; pre-startFrame defaults to 0 via an "opacity": "0" keyframe at frame 0). |
| `apps/web/src/editor/presets/subtitles/karaoke-word.ts` | One `<span>` per word inside one `<div>` per segment. Active word gets a `color` interpolation from gray→white at its `word.startFrame`. Segment container fades like fade-segment. |
| `apps/web/src/editor/presets/subtitles/slide-segment.ts` | Same HTML shape as fade-segment but adds `transform.translateY` keyframes (20px→0 on show, 0→-20px on hide). |
| `apps/web/tests/editor/presets/subtitles/fade-segment.test.ts` | Smoke-test all three presets with the same fixture transcript (`tests/fixtures/transcript-3segments.json`): assert HTML node count matches segments, all emitted keyframe properties are in `ANIMATABLE_KEYS`, frames are within `[layerStartFrame, layerStartFrame + lastSegmentEndFrame]`, no duplicate keyframes (same property+frame). |
| `apps/web/tests/fixtures/transcript-3segments.json` | 3 segments × ~3 words each, frames at 30fps. Used across preset and store tests. |

### New files (`apps/web` — store + UI)

| Path | Responsibility |
|------|---------------|
| `apps/web/src/editor/components/inspector/SubtitlePropsTab.tsx` | Renders the transcript editor: per-segment row with collapsed/expanded toggle, `DraggableNumberInput` for `startFrame`/`endFrame`, `<input>` for text, `+` to add segment, `×` to delete. When expanded, lists words with their own frame inputs. Header has a "Regenerate HTML+keyframes" button (with confirm if `manualOverride === true`). Calls `useEditorStore.updateSubtitleTranscript(layerId, nextTranscript)` on edits and `regenerateSubtitleLayer(layerId)` on the button. Shows a small "Manual override" badge when applicable. |
| `apps/web/src/editor/components/inspector/SubtitlePresetsTab.tsx` | Lists `SUBTITLE_PRESETS` (icon + name + description). Clicking one calls `setSubtitlePreset(layerId, key)` (which also regenerates). Highlights current `subtitle.presetKey`. |
| `apps/web/tests/editor/store.subtitle.test.ts` | Vitest for the new store actions (see Task 16). |
| `apps/web/tests/editor/components/SubtitlePropsTab.test.tsx` | Optional smoke render test (does not need to be deep — Testing Library not heavily used in repo, follow whatever pattern the existing `inspector/*.test.tsx` follow; if none, this test is a no-op stub). |

### Modified files (`apps/web` — store + UI)

| Path | Change |
|------|--------|
| `apps/web/src/editor/defaults.ts` | Add `defaultSubtitleLayer(args: { order, audioTrackId, transcript, presetKey })`. Calls `getSubtitlePreset(presetKey).generate(transcript, { layerStartFrame: 0, fps })` to materialize html/css/keyframes; sets `type: "subtitle"`, `subtitle: { linkedAudioTrackId, transcript, presetKey, manualOverride: false }`, `startFrame: 0`, `endFrame: lastSegmentEndFrame`. NOTE: `fps` must be passed in (defaults file is currently pure — change signature to `defaultSubtitleLayer({ order, audioTrackId, transcript, presetKey, fps })`). |
| `apps/web/src/editor/store.ts` | Add actions: `transcribeAudioTrack(trackId)`, `createSubtitleLayerFromTranscript(sceneId, trackId, transcript, presetKey)`, `updateSubtitleTranscript(layerId, transcript)`, `regenerateSubtitleLayer(layerId)`, `setSubtitleManualOverride(layerId, value)`, `setSubtitlePreset(layerId, presetKey)`. ALSO: in `updateLayerHtml`, `updateLayerCss`, and keyframe mutators, if the target layer is `type === "subtitle"`, set `l.subtitle.manualOverride = true`. The `mutateLayer` helper already returns the layer; the discriminated-union TS narrowing is done with `if (l.type === "subtitle")`. |
| `apps/web/src/editor/components/audio/AudioLaneRow.tsx` | Add `Captions` button between Mute and Scissors. Loading state via local `useState<"idle" \| "loading" \| "error">` — on click, invoke `transcribeAudioTrack(track.id)`. The store action subscribes to SSE and resolves when `status === "completed"` (or "error"). Show `Loader2` (spinning) icon while loading. Toast on completion ("Subtitle layer created") and on error ("Transcription failed: <msg>"). If subtitle layer already linked to this track exists, open `ConfirmDialog` with 3 options (Regenerate existing / Create new / Cancel) — extend `ConfirmDialog` if it only supports 2 buttons today, otherwise use a fresh `Dialog`. |
| `apps/web/src/editor/components/Inspector.tsx` | Branch the layer-tabs rendering by `activeLayer.type`. If `"subtitle"`: tabs = `[Props (SubtitlePropsTab), HTML, CSS, Keyframes, Presets (SubtitlePresetsTab)]`. If `"html"` (default): existing `LAYER_TABS`. The HTML/CSS/Keyframes tabs reuse the existing components — they just edit a different layer (and the store auto-sets `manualOverride` when they edit). |

### NOT touched (intentionally)

- `packages/runtime/**` — the subtitle layer materializes to html/css/keyframes, so the runtime renders it identically to an html layer. Verified via render-parity manual check (Task 24).
- `apps/web/src/lib/render/**` — no changes needed.
- `apps/web/src/editor/presets/animation-presets.ts` — animation presets and subtitle presets are separate registries.
- `packages/shared-types/src/schemas/audio.ts` — AudioTrack does not store the transcript; the cache lives on disk by `assetSha`.

---

## Acceptance criteria → task mapping

| AC | Maps to task(s) |
|----|----------------|
| 1. `docker-compose.yml` exists; `docker compose up whisper` works; `curl localhost:9000/docs` returns 200 | Task 1 |
| 2. `services/whisper/README.md` documents setup | Task 1 |
| 3. AudioLaneRow has Captions button; click on valid audio triggers transcription | Task 18 |
| 4. UI shows progress via SSE while transcribing | Task 17, 18 |
| 5. On completion: subtitle layer created in the audio's scene, selected | Task 14, 17 |
| 6. Player renders subtitle segments at their frames | Task 11, 14 (and existing runtime) |
| 7. MP4 render shows subtitles (parity Player ↔ Renderer) | Task 24 (manual check) |
| 8. Inspector → Props of subtitle shows transcript editor (segments + expandable words) | Task 19 |
| 9. Editing transcript does NOT regenerate html/css/keyframes | Task 16 |
| 10. Editing html/css/keyframes sets `manualOverride: true` + badge visible | Task 16, 19 |
| 11. "Regenerate" button regenerates html+keyframes (CSS preserved); confirm if override | Task 16, 19 |
| 12. Presets tab lists ≥2 subtitle presets; choosing one regenerates | Task 11–13, 20 |
| 13. Transcript cached server-side by `SHA256(assetSha+model+lang)`; 2nd click instant | Task 8 |
| 14. Legacy layers (no `type`) still load and render | Task 3, 6 |
| 15. `npm test` passes | Tasks 2, 3, 8, 11, 16 (and existing suites unaffected) |

---

## Task list (execution order)

Tasks are grouped into phases. Within a phase, tasks may have dependencies — see the "Depends on" line. The **parallelization summary** at the very bottom calls out independent tasks for subagent-driven execution.

---

### Phase 1 — Infrastructure

#### Task 1: Whisper Docker service + docs + env ✅

**Files:**
- Create: `docker-compose.yml`
- Create: `services/whisper/README.md`
- Modify: `.env.example`

- [x] **Step 1: Write the `docker-compose.yml`** with one service `whisper` using `onerahmet/openai-whisper-asr-webservice:latest-gpu`, env (`ASR_ENGINE=faster_whisper`, `ASR_MODEL=small`, `ASR_QUANTIZATION=float16`, `MODEL_IDLE_TIMEOUT=300`, `ASR_MODEL_PATH=/data/whisper`), volume `whisper-models:/data/whisper`, ports `9000:9000`, and `deploy.resources.reservations.devices` for NVIDIA. Add a comment block explaining CPU fallback (swap image to `:latest` and delete the deploy block).
- [x] **Step 2: Write `services/whisper/README.md`** covering: prerequisites (NVIDIA driver on Windows host, NVIDIA Container Toolkit in WSL2 with the exact `apt install` command and `systemctl restart docker`), verification command (`docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi`), how to launch (`docker compose up -d whisper`), first-run note ("the model is downloaded the first time you POST to /asr; expect a delay of ~30s for `small`"), how to switch model (set `ASR_MODEL=large-v3-turbo` and `docker compose up -d --force-recreate whisper`), how to verify (`curl localhost:9000/docs` and the OpenAPI page renders), CPU fallback, troubleshooting (port 9000 already used → change to `9001:9000`; model download timing out → increase `MODEL_IDLE_TIMEOUT`).
- [x] **Step 3: Append `.env.example`** with three lines: `WHISPER_URL=http://localhost:9000`, `WHISPER_DEFAULT_MODEL=small`, `WHISPER_DEFAULT_LANG=auto`.
- [x] **Step 4: Validate**: `docker compose config` parses without errors; `cat services/whisper/README.md` reads cleanly.
- [x] **Step 5: Commit** — message: `feat(infra): add whisper docker service for local transcription`.

**Depends on:** none. Can run first or in parallel with Task 2.

---

### Phase 2 — Schemas (shared-types)

#### Task 2: `TranscriptSchema` in shared-types ✅

**Files:**
- Create: `packages/shared-types/src/schemas/transcript.ts`
- Create: `packages/shared-types/tests/transcript.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [x] **Step 1: Write failing test** `transcript.test.ts` with cases: (a) a full transcript parses; (b) `words: []` default works when omitted; (c) negative frames rejected; (d) text fields preserved; (e) `language`/`model`/`generatedAt` all optional.
- [x] **Step 2: Run** `npm test -w packages/shared-types -- tests/transcript.test.ts` and confirm failure (module not found).
- [x] **Step 3: Implement `transcript.ts`** with the exact Zod shapes in "Authoritative type contracts" above; re-export from `index.ts`.
- [x] **Step 4: Run** the same test → all green; `npm run typecheck -w apps/web` → green (no breakage downstream because `Transcript` not yet referenced from `Layer`).
- [x] **Step 5: Commit** — `feat(shared-types): add TranscriptSchema for subtitle layers`.

**Depends on:** none. Can run in parallel with Task 1.

---

#### Task 3: Discriminated `LayerSchema` (html | subtitle)

**Files:**
- Modify: `packages/shared-types/src/schemas/layer.ts`
- Create: `packages/shared-types/tests/layer-discriminated.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [x] **Step 1: Write failing test** `layer-discriminated.test.ts`: (a) legacy object with no `type` field but valid html fields parses → `parsed.type === "html"` (default); (b) explicit `type: "html"` parses; (c) `type: "subtitle"` with valid `subtitle` block parses and round-trips; (d) `type: "subtitle"` without `subtitle` block fails; (e) `endFrame < startFrame` fails for both variants.
- [x] **Step 2: Run** `npm test -w packages/shared-types -- tests/layer-discriminated.test.ts` → fail.
- [x] **Step 3: Implement** the new `layer.ts` as specified in "Authoritative type contracts". Re-export `HtmlLayerSchema`, `SubtitleLayerSchema`, `HtmlLayer`, `SubtitleLayer`, and the discriminated `LayerSchema`/`Layer` types from `index.ts`. NOTE: implementor also removed duplicate `Layer` export from `packages/shared-types/src/types.ts` to avoid TS export ambiguity.
- [x] **Step 4: Run** `npm test -w packages/shared-types` (full suite). Then `npm run typecheck -w apps/web` — this WILL fail in `toProjectJson.ts`, `persistProjectJson.ts`, `defaults.ts`, store actions, and Inspector. **That is expected** — those are fixed in Tasks 5, 6, 14, 16, 21. Record the failure list as a checklist; don't fix here.
- [x] **Step 5: Commit** — `feat(shared-types): discriminated LayerSchema for subtitle support`. Note in commit body: "typecheck of apps/web will fail until Tasks 5,6,14,16,21 land."

**Depends on:** Task 2 (subtitle variant references `TranscriptSchema`).

---

### Phase 3 — DB + persistence

#### Task 4: Prisma migration for `Layer.type` and `Layer.subtitleData`

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/<timestamp>_layer_type_subtitle/migration.sql` (generated)

- [x] **Step 1: Edit `schema.prisma`** — add `type String @default("html") @db.VarChar(20)` and `subtitleData Json?` to `model Layer`.
- [x] **Step 2: Generate** `npm run db:migrate -w apps/web -- --name layer_type_subtitle`. Inspect the SQL it produced.
- [x] **Step 3: Run** the generated SQL on the test DB too: `DATABASE_URL=<.env.test value> npx prisma migrate deploy` from `apps/web/`. (Verify by `mysql -e "DESCRIBE Layer"` showing the two new columns.)
- [x] **Step 4: Regenerate client**: `npm run db:generate -w apps/web`. Confirm `Layer.type` and `Layer.subtitleData` appear in the generated types.
- [x] **Step 5: Commit** — `feat(db): add Layer.type and Layer.subtitleData columns`. Include the migration folder.

**Depends on:** none for SQL, but Task 3 must land before code uses these columns. Tasks 4 and 3 can run in parallel; their consumers (Task 5, 6) consume both.

---

#### Task 5: `persistProjectJson` writes `type` + `subtitleData`

**Files:**
- Modify: `apps/web/src/lib/persistence/persistProjectJson.ts`
- Modify: `apps/web/tests/lib/persistence/persistProjectJson.test.ts` (if it exists; else create)

- [x] **Step 1: Write failing test** — persist a project containing one html layer + one subtitle layer; reload via raw Prisma query; assert `type` and `subtitleData` columns hold the right values, and that the html layer has `subtitleData: null`.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Modify the layer `create.map`** to include `type: l.type` and `subtitleData: l.type === "subtitle" ? (l.subtitle as Prisma.InputJsonValue) : Prisma.JsonNull`. Discriminated union narrowing means TS knows `l.subtitle` exists when `l.type === "subtitle"`.
- [x] **Step 4: Run** test → pass. Also run `npm test -w apps/web -- tests/lib/persistence/` (full file).
- [x] **Step 5: Commit** — `feat(persistence): persist Layer.type and subtitleData`.

**Depends on:** Task 3, Task 4.

---

#### Task 6: `toProjectJson` hydrates `type` + `subtitleData` with legacy fallback

**Files:**
- Modify: `apps/web/src/lib/persistence/toProjectJson.ts`
- Modify: `apps/web/tests/lib/persistence/toProjectJson.test.ts` (if exists; else create)

- [x] **Step 1: Write failing test** — (a) seed a Layer row with `type: NULL` simulated via direct SQL (or with the new column not yet set) → `toProjectJson` returns layer with `type: "html"`. (b) seed a Layer row with `type: "subtitle"` and a valid `subtitleData` JSON → `toProjectJson` returns the subtitle variant intact. NOTE: SQL NULL injection blocked by NOT NULL DB constraint; legacy fallback verified at the schema-level via `z.preprocess`.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Modify the layer `.map`** to read `type` (defaulting `??` to `"html"`) and `subtitleData`; when `type === "subtitle"`, include `subtitle: subtitleData as ...`; otherwise omit the field. The trailing `ProjectSchema.parse(project)` runs the discriminated union validator.
- [x] **Step 4: Run** tests → pass.
- [x] **Step 5: Commit** — `feat(persistence): hydrate Layer.type with html fallback for legacy rows`.

**Depends on:** Task 3, Task 4. Independent of Task 5.

---

### Phase 4 — Backend (transcript service + endpoints)

#### Task 7: `transcriptRegistry` (SSE state)

**Files:**
- Create: `apps/web/src/lib/transcript/transcriptRegistry.ts`
- Create: `apps/web/src/lib/transcript/types.ts`
- Create: `apps/web/tests/lib/transcript/transcriptRegistry.test.ts`

- [x] **Step 1: Write failing test** — `create()` returns a job with `status: "queued"`; `update()` mutates and notifies subscribers; `subscribe()` returns an unsub function; subscribing to a non-existent id returns a no-op unsub.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** the registry as a 1:1 clone of `renderRegistry.ts` (global singleton on `globalThis`, Map + Set), with `TranscriptJob` shape from "Authoritative type contracts".
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(transcript): job registry with SSE-style subscribe`.

**Depends on:** none.

---

#### Task 8: Whisper client + disk cache

**Files:**
- Create: `apps/web/src/lib/transcript/whisperClient.ts`
- Create: `apps/web/src/lib/transcript/mapWhisperResponse.ts`
- Create: `apps/web/src/lib/transcript/cacheKey.ts`
- Create: `apps/web/tests/lib/transcript/mapWhisperResponse.test.ts`
- Create: `apps/web/tests/lib/transcript/whisperClient.test.ts`

- [x] **Step 1: Write failing tests** — `mapWhisperResponse.test.ts` with a Whisper-shaped fixture (text+segments+words with `start`/`end`/`word`) → assert frames at 30fps and 60fps round correctly, empty words filtered, missing segment id replaced. `whisperClient.test.ts` with mocked `global.fetch` and mocked `fs/promises` → cache miss writes file; cache hit short-circuits without calling fetch; status callbacks fire (`"model-loading"` then `"transcribing"`).
- [x] **Step 2: Run** tests → fail.
- [x] **Step 3: Implement** the three files. `whisperClient` builds the multipart request via the `FormData` global (Node 20+ has it natively), reads the audio file via `fs.createReadStream`, posts to `${WHISPER_URL}/asr?...&output=json&word_timestamps=true`. Reads response as JSON, hands to `mapWhisperResponse`. Writes cache under `apps/web/.cache/transcripts/` (create dir if missing).
- [x] **Step 4: Run** tests → pass.
- [x] **Step 5: Commit** — `feat(transcript): whisper HTTP client with SHA256 disk cache`.

**Depends on:** Task 7 (uses `TranscriptJob` status enum), Task 2 (uses `Transcript` type).

---

#### Task 9: `runTranscriptJob` orchestrator + POST endpoint

**Files:**
- Create: `apps/web/src/lib/transcript/runTranscriptJob.ts`
- Create: `apps/web/src/app/api/projects/[id]/audioTracks/[trackId]/transcript/route.ts`
- Create: `apps/web/tests/api/transcript-post.test.ts`

- [x] **Step 1: Write failing test** — `transcript-post.test.ts`: POST with valid project+track returns 202 and `{ jobId: string }`; POST with unknown trackId returns 404; the registry has the job. Mock the whisper fetch via `vi.spyOn(globalThis, "fetch")` resolving with a 3-segment fixture.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** `runTranscriptJob(jobId)` (uses pattern from `assetResolver.ts` / `buildRenderProject.ts`: `path.join(process.cwd(), "public", publicRelative)`). Route handler validates project + track, creates job, fire-and-forget, returns `{ jobId }` 202.
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(api): POST /transcript starts whisper job`.

**Depends on:** Task 7, Task 8.

---

#### Task 10: SSE endpoint for transcript events

**Files:**
- Create: `apps/web/src/app/api/projects/[id]/audioTracks/[trackId]/transcript/events/route.ts`
- Create: `apps/web/tests/api/transcript-events.test.ts`

- [x] **Step 1: Write failing test** — pre-create a job via the registry, GET the SSE endpoint with `?jobId=...`; collect events; assert initial + `"transcribing"` + `"completed"` arrive in order with full transcript payload.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** the SSE route as a near-verbatim clone of `apps/web/src/app/api/render/[projectId]/[renderId]/events/route.ts`. Reads `jobId` from `new URL(req.url).searchParams`. Drops the params context arg (route doesn't need id/trackId).
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(api): SSE stream for transcript job progress`.

**Depends on:** Task 7, Task 9.

---

### Phase 5 — Subtitle presets

#### Task 11: Subtitle preset types + fade-segment (default)

**Files:**
- Create: `apps/web/src/editor/presets/subtitles/types.ts`
- Create: `apps/web/src/editor/presets/subtitles/registry.ts`
- Create: `apps/web/src/editor/presets/subtitles/fade-segment.ts`
- Create: `apps/web/tests/fixtures/transcript-3segments.json`
- Create: `apps/web/tests/editor/presets/subtitles/fade-segment.test.ts`

- [x] **Step 1: Write failing test** — load fixture, run `fadeSegment.generate(transcript, { layerStartFrame: 0, fps: 30 })`. Assert: HTML contains exactly 3 `.subtitle-segment` divs; HTML-escapes special chars; CSS contains `@keyframes subtitle-show-N` and `subtitle-hide-N` per segment; engine keyframes array is empty (v1 CSS-only approach).
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** `types.ts` (contracts), `registry.ts` (array + `getSubtitlePreset(key)`), and `fade-segment.ts`. **v1 simplification**: use pure CSS `@keyframes` animations per segment for show/hide instead of engine-level keyframes (which apply only to the layer root). Engine `keyframes` array is empty. Documented in source comment.
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(presets): subtitle-fade-segment as default subtitle preset`.

**Depends on:** Task 2 (uses `Transcript` type).

---

#### Task 12: `subtitle-karaoke-word` preset

**Files:**
- Create: `apps/web/src/editor/presets/subtitles/karaoke-word.ts`
- Modify: `apps/web/src/editor/presets/subtitles/registry.ts` (register)
- Create: `apps/web/tests/editor/presets/subtitles/karaoke-word.test.ts`

- [x] **Step 1: Write failing test** — load fixture, run karaoke. Assert HTML has 3 `.subtitle-segment` + 15 `.subtitle-word` spans with `data-s`/`data-w`; CSS contains `subtitle-seg-show-N` and `subtitle-word-highlight-S-W` keyframes; engine keyframes empty.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** the preset using CSS-only animations (same v1 approach as fade-segment).
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(presets): subtitle-karaoke-word for per-word highlight`.

**Depends on:** Task 11.

---

#### Task 13: `subtitle-slide-segment` preset

**Files:**
- Create: `apps/web/src/editor/presets/subtitles/slide-segment.ts`
- Modify: `apps/web/src/editor/presets/subtitles/registry.ts` (register)
- Create: `apps/web/tests/editor/presets/subtitles/slide-segment.test.ts`

- [x] **Step 1: Write failing test** — HTML mirrors fade-segment; CSS contains `subtitle-slide-show-N` / `subtitle-slide-hide-N` keyframes with translateY 20px→0px→-20px; engine keyframes empty.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** the preset.
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(presets): subtitle-slide-segment with vertical slide-in/out`.

**Depends on:** Task 11. Independent of Task 12.

---

### Phase 6 — Store actions

#### Task 14: `defaultSubtitleLayer` + `createSubtitleLayerFromTranscript`

**Files:**
- Modify: `apps/web/src/editor/defaults.ts`
- Modify: `apps/web/src/editor/store.ts`
- Create: `apps/web/tests/editor/store.subtitle-create.test.ts`

- [x] **Step 1: Write failing test** — bootstrap the store; call `createSubtitleLayerFromTranscript(sceneId, trackId, fixtureTranscript, "subtitle-fade-segment")`. Assert (a) layer with `type: "subtitle"`; (b) `subtitle.linkedAudioTrackId`; (c) `presetKey`; (d) `manualOverride: false`; (e) html non-empty; (f) `keyframes.length === 0` (v1 CSS-only); (g) `selectedLayerId` points to new layer.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** `defaultSubtitleLayer({ order, audioTrackId, transcript, presetKey, fps })` in `defaults.ts`. In `store.ts`, add `createSubtitleLayerFromTranscript`. Also added the action signature to `store.types.ts`.
- [x] **Step 4: Run** test → pass.
- [x] **Step 5: Commit** — `feat(store): createSubtitleLayerFromTranscript action`.

**Depends on:** Task 3, Task 11.

---

#### Task 15: `updateSubtitleTranscript` (no auto-regen) + `regenerateSubtitleLayer`

**Files:**
- Modify: `apps/web/src/editor/store.ts`
- Modify: `apps/web/tests/editor/store.subtitle-create.test.ts` (extend) or new `apps/web/tests/editor/store.subtitle-regen.test.ts`

- [x] **Step 1: Write failing tests** — (a) `updateSubtitleTranscript` updates transcript but html/css/keyframes UNCHANGED; (b) `regenerateSubtitleLayer` regenerates html+keyframes, preserves css, resets `manualOverride`, recomputes `endFrame`.
- [x] **Step 2: Run** tests → fail.
- [x] **Step 3: Implement** both actions in store.ts + signatures in store.types.ts. Regen discards regenerated css and preserves existing.
- [x] **Step 4: Run** tests → pass (7 new + 20 combined subtitle tests green).
- [x] **Step 5: Commit** — `feat(store): subtitle transcript edit (no auto-regen) and explicit regenerate`.

**Depends on:** Task 14.

---

#### Task 16: Manual-override dirty flag + `setSubtitlePreset`

**Files:**
- Modify: `apps/web/src/editor/store.ts`
- Create: `apps/web/tests/editor/store.subtitle-override.test.ts`

- [x] **Step 1: Write failing tests** — dirty-flag injection on all content mutators; setSubtitleManualOverride clears; setSubtitlePreset updates key + regenerates html.
- [x] **Step 2: Run** tests → fail.
- [x] **Step 3: Implement** dirty-flag in updateLayerHtml/Css/addKeyframe/updateKeyframeValue/updateKeyframeEasing/moveKeyframe/deleteKeyframe + new actions setSubtitleManualOverride and setSubtitlePreset. Restructured addKeyframe's `if (existing) return` to fall through to dirty-flag line.
- [x] **Step 4: Run** tests → pass (15 new + 138 total store tests green).
- [x] **Step 5: Commit** — `feat(store): manualOverride dirty flag and setSubtitlePreset`.

**Depends on:** Task 14, Task 15.

---

#### Task 17: `transcribeAudioTrack` (SSE client wiring)

**Files:**
- Modify: `apps/web/src/editor/store.ts`
- Create: `apps/web/tests/editor/store.transcribe.test.ts`

- [x] **Step 1: Write failing test** — mock fetch (POST + SSE); cover happy path, SSE error, POST 500, unknown trackId.
- [x] **Step 2: Run** test → fail.
- [x] **Step 3: Implement** the action with `fetch` POST + manual SSE reader. Upgrade `immer((set) => ...)` to `immer((set, get) => ...)` to enable async `get()`.
- [x] **Step 4: Run** test → pass (4 new + 39 combined subtitle tests green).
- [x] **Step 5: Commit** — `feat(store): transcribeAudioTrack drives SSE and creates subtitle layer`.

**Depends on:** Task 9, Task 10, Task 14.

---

### Phase 7 — UI: audio track button

#### Task 18: "Captions" button in `AudioLaneRow`

**Files:**
- Modify: `apps/web/src/editor/components/audio/AudioLaneRow.tsx`
- Modify: `apps/web/src/editor/components/audio/AudioLaneRow.test.tsx` (if exists; else inline at first manual QA)

- [x] **Step 1: Write failing render test (or skip if the file doesn't exist — note in commit)** — TL not configured in repo; skipped per commit body.
- [x] **Step 2: N/A** (no test).
- [x] **Step 3: Implement** — Captions + Loader2 button between Mute and Scissors; loading state from `transcriptionStatus`; 3-button Dialog when subtitle layer already linked; toast feedback via `useEffect`.
- [x] **Step 4: Manual QA pending in Task 24**.
- [x] **Step 5: Commit** — `feat(audio): captions button on audio lane triggers transcript`.

**Depends on:** Task 17.

---

### Phase 8 — UI: Inspector subtitle variant

#### Task 19: `SubtitlePropsTab` (transcript editor)

**Files:**
- Create: `apps/web/src/editor/components/inspector/SubtitlePropsTab.tsx`
- Create: `apps/web/tests/editor/components/SubtitlePropsTab.test.tsx` (optional smoke)

- [x] **Step 1: Test skipped** — TL not configured in repo.
- [x] **Step 2: N/A**.
- [x] **Step 3: Implement** SubtitlePropsTab with header (name input, start/end DraggableNumberInput, Regenerate button, Manual override badge), scrollable list of `SegmentRow` (chevron, frame inputs, debounced text, delete), Add segment button. Mutations build immutable nextTranscript and call `updateSubtitleTranscript`.
- [x] **Step 4: Manual QA pending in Task 24**.
- [x] **Step 5: Commit** — `feat(inspector): subtitle props tab with editable transcript`.

**Depends on:** Task 15, Task 16.

---

#### Task 20: `SubtitlePresetsTab`

**Files:**
- Create: `apps/web/src/editor/components/inspector/SubtitlePresetsTab.tsx`

- [x] **Step 1: Pending in Task 24 manual QA**.
- [x] **Step 2: Implement** SubtitlePresetsTab — vertical list of preset cards with iconLookup, active preset highlighted, ConfirmDialog gate when manualOverride is true.
- [x] **Step 3: Pending in Task 24**.
- [x] **Step 4: Commit** — `feat(inspector): subtitle presets tab`.

**Depends on:** Task 16.

---

#### Task 21: Wire Inspector to branch by `layer.type`

**Files:**
- Modify: `apps/web/src/editor/components/Inspector.tsx`

- [x] **Step 1: Read existing tab-rendering section** in `Inspector.tsx`.
- [x] **Step 2: Implement** — inline branching with `isSubtitleLayer` type guard; subtitle layer swaps Props (→SubtitlePropsTab) and Presets (→SubtitlePresetsTab). HTML/CSS/Keyframes reuse existing components.
- [x] **Step 3: Run** typecheck — closed yellow window in follow-up commit `2eb6ccc` (fix(types)).
- [x] **Step 4: Manual QA pending in Task 24**.
- [x] **Step 5: Commit** — `feat(inspector): branch tabs by layer.type`.

**Depends on:** Task 19, Task 20.

---

### Phase 9 — API docs

#### Task 22: `openapi.yaml` updates

**Files:**
- Modify: `apps/web/openapi.yaml`

- [x] **Step 1: Add new schemas** — TranscriptWord, TranscriptSegment, Transcript, TranscriptJob; refactor Layer to `oneOf [HtmlLayer, SubtitleLayer]` with discriminator on `type` plus shared `LayerCore` via allOf.
- [x] **Step 2: Add two paths** — POST and SSE GET documented with query params and response shapes.
- [x] **Step 3: Validate** — redocly lint: 9 warnings (pre-existing or SSE-inherent), 0 errors.
- [x] **Step 4: Build docs** — redoc.html (1338 KiB) built successfully.
- [x] **Step 5: Commit** — `docs(api): document transcript endpoints and discriminated Layer`.

**Depends on:** Tasks 9 and 10 to be done (endpoints exist).

---

### Phase 10 — Integration validation

#### Task 23: End-to-end store smoke (mock whisper)

**Files:**
- Create: `apps/web/tests/integration/transcript-e2e.test.ts`

- [x] **Step 1: Write the integration test** — mocked fetch routes POST → 202 jobId and SSE GET → ReadableStream with queued/transcribing/completed events; covers transcribe → subtitle layer creation → updateTranscript (no regen) → regenerate (rebuilt html).
- [x] **Step 2: Run** the test → PASS immediately (no wiring issues across earlier tasks).
- [x] **Step 3: Commit** — `test(transcript): end-to-end subtitle creation and regeneration`.

**Depends on:** Tasks 8, 9, 10, 14–17.

---

#### Task 24: Render parity manual QA

**Files:** none (manual; document the result in the PR description).

- [ ] **Step 1: Manual check** — `docker compose up -d whisper`. `npm run dev`. Upload a short audio (10–30s), drop on timeline. Click Captions on the audio track. Wait for layer creation.
- [ ] **Step 2: Preview** — scrub the timeline, confirm subtitles appear at the expected frames in the Player.
- [ ] **Step 3: Render** — trigger a render via `POST /api/render/<projectId>` (or the UI button). When MP4 is ready, scrub through and confirm subtitles are present at the same frames as the preview.
- [ ] **Step 4: Spot-check** — edit the transcript text in Inspector → confirm Player shows new text (since HTML wasn't regenerated, the change is only in `subtitle.transcript`; the visible HTML is stale — **this is the expected behavior per the dirty-flag design**). Click Regenerate → confirm Player now shows updated text.
- [ ] **Step 5: Document** the result in the PR description with screenshots / a short Loom.

**Depends on:** everything.

---

## Risks & mitigations

| Risk | Mitigation (in plan) |
|------|---------------------|
| Whisper container takes 30s+ first time (model download) | SSE emits `model-loading` so the UI can show a clear message. Document in README. |
| GPU passthrough on WSL2 misconfigured → container can't see the GPU | README documents `nvidia-container-toolkit` install and the verification command. If GPU is unavailable, falling back to the CPU image is a one-line edit. |
| Long audio exhausts VRAM at `small` model | RTX 2060 + `small` is comfortable for audios <10 min. README documents how to switch to `tiny` if needed. |
| Whisper response shape varies by engine | The webservice with `ASR_ENGINE=faster_whisper` is the only supported config in this plan; `mapWhisperResponse` is written against that exact JSON shape, with a focused unit test. If we add `whisperx` later, that goes in a follow-up plan. |
| Discriminated-union TS narrowing leaks into many files | Task 3 acknowledges typecheck will break in apps/web until Tasks 5,6,14,16,21 land. We accept a yellow window and finish the union rollout in a tight burst. |
| Manual override and Regenerate UX could confuse users | Badge + confirm-dialog wording must be explicit. Test in real use during Task 24. |
| Cache invalidation: if user re-uploads the same audio under a new asset, cache key collides on `assetSha` | This is a feature: same audio sha → same transcript. Acceptable. |
| Transcripts inflate ProjectJson autosave payload | JSON column already supports it; ProjectJson PATCH is debounced 5s. Monitor in QA. If it becomes a problem, future plan moves transcripts to a separate Prisma table. |

---

## Parallelization summary (for subagent-driven execution)

**Wave 1 (no dependencies, fully parallel):**
- Task 1 (Docker + README + env)
- Task 2 (TranscriptSchema)
- Task 7 (transcriptRegistry)
- Task 4 (Prisma migration) — Task 3 must merge first if it lands close, but the migration SQL itself is independent of the Zod code.

**Wave 2 (depend on Wave 1):**
- Task 3 (LayerSchema union) — needs Task 2
- Task 8 (whisperClient) — needs Tasks 2, 7
- Task 11 (fade-segment preset) — needs Task 2

**Wave 3 (depend on Wave 2):**
- Tasks 5 + 6 (persistence) — need Tasks 3, 4
- Task 9 (POST endpoint) — needs Tasks 7, 8
- Tasks 12 + 13 (karaoke + slide presets) — need Task 11

**Wave 4 (depend on Wave 3):**
- Task 10 (SSE endpoint) — needs Tasks 7, 9
- Task 14 (createSubtitleLayerFromTranscript) — needs Tasks 3, 11

**Wave 5 (sequential within store):**
- Task 15 → 16 (must be sequential; both modify the store and Task 16 builds on 15)

**Wave 6:**
- Task 17 (transcribeAudioTrack) — needs Tasks 9, 10, 14

**Wave 7 (UI + docs):**
- Task 18 (AudioLaneRow button) — needs Task 17
- Task 19 (SubtitlePropsTab) — needs Tasks 15, 16
- Task 20 (SubtitlePresetsTab) — needs Task 16
- Task 22 (openapi.yaml) — needs Tasks 9, 10 (can run in parallel with 18/19/20)

**Wave 8:**
- Task 21 (Inspector wire) — needs Tasks 19, 20
- Task 23 (integration test) — needs Tasks 8, 9, 10, 14–17

**Wave 9 (manual):**
- Task 24 (manual render parity QA) — needs everything

---

## Final notes

- **Single PR vs split**: 24 tasks is a lot, but they form one coherent feature. Recommend a single feature branch; if review fatigue is a concern, split into two PRs at the Wave 3 / Wave 4 boundary (backend+schemas first, UI+store second).
- **Validation commands**: at any point, `npm test` from repo root runs the full suite (Vitest with `fileParallelism: false` in apps/web). Single-file: `npm test -w apps/web -- tests/lib/transcript/whisperClient.test.ts`. Lint: `npm run lint -w apps/web`. Typecheck: `npm run typecheck -w apps/web`. Docs: `npm run docs:lint -w apps/web && npm run docs:build -w apps/web`.
- **Rollback**: the Prisma migration adds nullable/defaulted columns only — safe to roll forward without data loss. Revert path: `prisma migrate resolve --rolled-back <migration-name>` then drop columns manually if needed.
