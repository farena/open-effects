---
name: open-effects-video
description: Authoritative reference for driving open-effects through its HTTP API — asset upload, project creation, PATCHing ProjectJson (scenes, layers, keyframes, audio tracks), and (optionally) triggering renders. Use this skill ANY time the user asks to add, edit, remove, or animate scenes / layers / keyframes / audio in an open-effects project, whether from the terminal or from the in-editor AI chat. Trigger on phrases like "add a scene", "agregar escena", "añadir layer", "create a video", "edit the project", "make this fade in", "render the project", "build an MP4", or any other open-effects ProjectJson edit. Rendering is OPTIONAL — only run the render steps when the user explicitly asks to render/export.
metadata:
  tags: open-effects, video, api, render, remotion, automation, scenes, layers, keyframes
---

# Creating videos with the open-effects API

This skill is the canonical entry point for driving open-effects programmatically.
It encodes the 5-step pipeline from `docs/api/programmatic-guide.md` into a
prescriptive checklist, with the schema invariants that the runtime enforces.

## Preconditions

- Dev server running at `http://localhost:3000` (or override via `BASE_URL`).
- `curl`, `jq`, and FFmpeg installed locally.
- The user has authorized creating a project on this server. **Do NOT** auto-render
  or auto-upload to a remote/shared deployment without explicit approval — see
  the "Auth & blast radius" note at the end.

## The 5-step pipeline

```
1. POST /api/assets             multipart upload, dedup by SHA-256
2. POST /api/projects           returns { id }
3. PATCH /api/projects/:id      full ProjectJson (the source of truth)
4. POST /api/render/:projectId  fire-and-forget, returns { renderId }
5. SSE  /api/render/:projectId/:renderId/events   until status = completed
6. GET  /renders/:projectId/:filename             static download (no /api/)
```

## Discovering the live spec

Before generating any ProjectJson by hand, fetch the running spec — it is the
authoritative truth for the deployment you are talking to. The repo also ships a
local copy you can read offline.

```bash
# Live (matches the running server's behavior 1:1)
curl -s http://localhost:3000/api/openapi.yaml > /tmp/oe-openapi.yaml

# Or read in-repo
cat apps/web/openapi.yaml
```

Use it to validate field names, enums, and constraints (e.g. `fps ∈ {24, 30, 60}`,
`durationFrames ≥ 1`, `endFrame ≥ startFrame`, `trimEnd > trimStart`,
`width/height ≤ 7680`, `volume ∈ [0, 1]`).

## Step-by-step

### 1) Upload assets (optional)

```bash
ASSET=$(curl -s -X POST http://localhost:3000/api/assets \
  -F "file=@/path/to/audio.mp3")
ASSET_ID=$(echo "$ASSET"   | jq -r '.id')
ASSET_PATH=$(echo "$ASSET" | jq -r '.path')
```

- Accepted MIME types are listed in `apps/web/src/lib/assets/mimeWhitelist.ts`.
- Limit is 200 MB per file.
- Re-uploading the same bytes returns the existing record (SHA-256 dedup) — that
  is fine, just keep the returned `id`/`path`.

### 2) Create project

```bash
PROJECT_ID=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Video","width":1280,"height":720,"fps":30}' \
  | jq -r '.id')
```

Returns `{ "id": "<cuid2>" }`. The project is seeded with one default empty scene.

### 3) PATCH the full ProjectJson

This is the one call that actually defines the video. The body must validate against
`ProjectSchema` from `packages/shared-types`. Easiest path: start from
`docs/api/examples/minimal-project.json` and substitute values with `jq`.

```bash
jq \
  --arg pid "$PROJECT_ID" \
  --arg aid "$ASSET_ID"   \
  --arg ap  "$ASSET_PATH" \
  '.id = $pid
   | .scenes[0].audioTracks[0].assetId   = $aid
   | .scenes[0].audioTracks[0].assetPath = $ap' \
  docs/api/examples/minimal-project.json \
| curl -s -X PATCH "http://localhost:3000/api/projects/${PROJECT_ID}" \
    -H "Content-Type: application/json" --data-binary @-
```

Schema invariants worth double-checking before sending:

| Field | Constraint |
|---|---|
| `fps` | one of `24 \| 30 \| 60` |
| `width`, `height` | integer, `1..7680` |
| `scene.durationFrames` | integer, `≥ 1` |
| `layer.endFrame` | integer, `≥ startFrame` |
| `audioTrack.trimEnd` | integer, `> trimStart` |
| `volumeKeyframe.value` | number, `0..1` |
| `keyframe.frame` | scene-local (or layer-local) frame index, `≥ 0` |
| `transitionIn.type` | `none \| fade \| slide-{left,right,up,down}` |

Easing is a discriminated union on `type`:
`linear`, `ease-in`, `ease-out`, `ease-in-out`,
`cubic-bezier` (`params: [x1, y1, x2, y2]`),
`spring` (`params: { damping, stiffness, mass }`).

### 4) Trigger the render — **explicit user request only**

Skip this step (and steps 5–6) when the user only asked to add/edit scenes,
layers, keyframes, or audio. Edits are previewed live in the editor and the
user renders themselves when ready. Run a render only when the user explicitly
says "render", "export", "generate the MP4", or similar.

```bash
RENDER_ID=$(curl -s -X POST "http://localhost:3000/api/render/${PROJECT_ID}" \
  | jq -r '.renderId')
```

Returns 202 + `{ renderId }`. The job runs async; track via SSE.

### 5) Follow SSE until completion

```bash
OUTPUT_URL=""
while IFS= read -r line; do
  [[ "$line" == data:* ]] || continue
  JOB="${line#data: }"
  STATUS=$(jq -r '.status'   <<<"$JOB")
  PCT=$(jq   -r '((.progress // 0) * 100 | floor)' <<<"$JOB")
  echo "[$STATUS] ${PCT}%"
  case "$STATUS" in
    completed) OUTPUT_URL=$(jq -r '.outputUrl' <<<"$JOB"); break ;;
    error)     echo "render failed: $(jq -r '.error' <<<"$JOB")"; exit 1 ;;
  esac
done < <(curl -sN "http://localhost:3000/api/render/${PROJECT_ID}/${RENDER_ID}/events")
```

`status` advances `queued → bundling → rendering → completed` (or `error`).
`progress` is a 0..1 fraction.

### 6) Download the MP4

`outputUrl` is a static path under `/renders/...` — **no `/api/` prefix**.

```bash
curl -s -o "$(basename "$OUTPUT_URL")" "http://localhost:3000${OUTPUT_URL}"
```

Optional cleanup of a stale render file:

```bash
curl -s -X DELETE \
  "http://localhost:3000/api/projects/${PROJECT_ID}/renders/$(basename "$OUTPUT_URL")"
```

## Drop-in end-to-end script

A complete reference implementation lives at
[`scripts/render-video.sh`](./scripts/render-video.sh). Invoke it like:

```bash
bash .claude/skills/open-effects-video/scripts/render-video.sh \
  /path/to/audio.mp3 docs/api/examples/minimal-project.json
```

Read the script before running it — adapt `BASE_URL`, the audio file path, and
the JSON template to your needs. It is intentionally short so it can be edited
in place rather than parameterized to death.

## When things go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `400 missing_file` on upload | empty/invalid multipart | curl with `-F "file=@..."`, not `-d` |
| `400 Unsupported mime type:` | type not in whitelist | re-encode (`ffmpeg -i in.foo out.mp3`) |
| `400 File too large` | > 200 MB | trim/encode with FFmpeg first |
| `400` on PATCH with field errors | ProjectJson does not validate | inspect the `error.fieldErrors` Zod output and fix the offending path |
| `404` on PATCH/DELETE | project id wrong | re-list with `GET /api/projects` |
| Render stuck on `queued` | server crashed or never started job | check the dev server logs; the in-memory render registry does not survive a restart |
| MP4 missing after `completed` | downloaded path included `/api/` | remember: `outputUrl` is a static path, no `/api/` |
| Audio plays raw, EQ ignored | EQ is render-only | this is by design; preview does not apply EQ |

## Auth & blast radius

- v1 has **no authentication**. Treat any non-localhost target as production.
- Renders write to `apps/web/public/renders/<projectId>/`. Old files accumulate
  unless you DELETE them — fine for dev, plan retention before deploying.
- `POST /api/render/:projectId` is **fire-and-forget**: there is no built-in
  cancel. If you start the wrong render, wait for it or restart the server.

## Where to look next

- `apps/web/openapi.yaml` — full schema reference (`info.version: 1.1.0`).
- `docs/api/programmatic-guide.md` — long-form prose version of these steps.
- `docs/api/examples/` — JSON fixtures (`minimal-project.json` is the safest
  starting point).
- `packages/shared-types/src/schemas/` — the Zod source for every shape above.
