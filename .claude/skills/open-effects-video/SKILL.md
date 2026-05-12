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
| `project.css` | optional string; global CSS shared across all scenes/layers (good place for `@import` font declarations, `@font-face`, shared `@keyframes`, utility classes). Unlike per-layer CSS it is NOT scoped. |

Easing is a discriminated union on `type`:
`linear`, `ease-in`, `ease-out`, `ease-in-out`,
`cubic-bezier` (`params: [x1, y1, x2, y2]`),
`spring` (`params: { damping, stiffness, mass }`).

#### Custom keyframes (`$KEY` placeholders)

Built-in keyframe properties (`opacity`, `transform.translateX`, `color`, …) cover
the common CSS animations. For anything else — a counter that ticks `0 → 100`, a
gradient stop position, a clip-path inset, an SVG attribute — use **custom
keyframes**: user-named numeric variables that are interpolated per frame and
substituted into the layer's HTML/CSS via `$KEY` placeholders.

**Layer-only.** Custom keyframes apply to the layer that owns the HTML/CSS
template. Scenes have no template, so `custom.*` properties on a scene are
ignored.

**Schema.** Reuses the existing `Keyframe` shape — the discriminator is the
`property` field, which must start with `custom.`:

```json
{
  "property": "custom.POSITION_X",
  "frame": 0,
  "value": "0",
  "easingOut": { "type": "linear" }
}
```

| Field | Constraint |
|---|---|
| `property` | `custom.<KEY>` where `KEY` matches `^[A-Z][A-Z0-9_]{0,31}$` |
| `value` | numeric string (e.g. `"0"`, `"57.3"`) — units go in the template, not the value |
| `easingOut` | same union as built-in keyframes |

**Reference syntax.** Inside the layer's `html` or `css`, write `$KEY` (no
braces, no prefix). The runtime regex is `\$([A-Z][A-Z0-9_]*)` — must start with
an uppercase letter. Lowercase `$foo` is not substituted.

**Units belong in the template, not the value.** Custom keyframes are pure
numbers. Append the unit next to the placeholder:

```json
{
  "html": "<div class=\"box\">x = $POSITION_X</div>",
  "css":  ".box { transform: translateX($POSITION_Xpx); opacity: $OPACITY; }",
  "keyframes": [
    { "property": "custom.POSITION_X", "frame": 0,  "value": "0",   "easingOut": { "type": "linear" } },
    { "property": "custom.POSITION_X", "frame": 30, "value": "200", "easingOut": { "type": "linear" } },
    { "property": "custom.OPACITY",    "frame": 0,  "value": "0",   "easingOut": { "type": "linear" } },
    { "property": "custom.OPACITY",    "frame": 15, "value": "1",   "easingOut": { "type": "linear" } }
  ]
}
```

**Behavior.**

- Interpolation is **always numeric** (`String(lerp(parseFloat(a), parseFloat(b), t))`).
  No color or length variants — concatenate units in the template instead.
- Frames are layer-local, just like built-in keyframes (clamped before the first
  and after the last keyframe).
- Substitution runs **per frame**, after the HTML sanitizer and after the CSS
  scoper, on every visible frame.
- A `$KEY` reference whose key has no keyframes is left **unsubstituted** so the
  bug is visible at render time (e.g. CSS will read `translateX($MISSINGpx)`,
  which the browser rejects, surfacing the typo immediately).

**When to use a custom keyframe vs. a built-in property:**

- Use built-ins (`opacity`, `transform.*`, `color`, ...) whenever the target IS
  a CSS property already in the registry — they emit `style.*` directly, no
  string substitution overhead, and the browser GPU-composites them.
- Reach for a custom keyframe when:
  - The animated thing is **inside the HTML text** (counters, percentages, dynamic copy).
  - You need a value that drives **multiple CSS properties** at once (one
    `$T` placeholder used in `transform`, `opacity`, and `border-radius`).
  - The CSS property isn't in the registry (`clip-path`, `filter`, gradient
    stops, `stroke-dashoffset`, SVG attributes, etc.).

**Editor UI.** In the keyframe inspector for a layer, the **+ Custom keyframe**
button accepts an UPPER_SNAKE_CASE name and creates the first keyframe at the
current local frame with value `0`. Subsequent keyframes for that key are added
with the same `+ keyframe at frame N` action used by built-ins.

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

## Material Symbols (Google icons)

Material Symbols are available as a web font directly inside any layer — no asset upload, no extra dependency. Three families: `material-symbols-outlined`, `material-symbols-rounded`, `material-symbols-sharp`.

The HTML sanitizer keeps `<span class="…">` and inline `style`, and the per-layer CSS scoper (`postcss-prefix-selector`) leaves `@import` at-rules untouched, so the font loads cleanly per layer.

**Recipe.** In the layer's `css`, put `@import` as the **first rule** (CSS spec: `@import` must precede all other rules). In the layer's `html`, write the icon's ligature name as the text content of a `<span>`:

```json
{
  "html": "<span class=\"material-symbols-outlined icon\">favorite</span>",
  "css": "@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'); .icon { font-size: 240px; color: #fff; font-variation-settings: 'FILL' 1, 'wght' 500; }"
}
```

Variation axes (all optional, set via `font-variation-settings`):

| Axis  | Range      | Effect                                       |
|-------|------------|----------------------------------------------|
| `wght`| 100–700    | Stroke weight                                |
| `FILL`| 0 or 1     | 0 = outlined, 1 = filled                     |
| `opsz`| 20–48      | Optical size (match to rendered font-size)   |
| `GRAD`| -50..200   | Emphasis (subtle weight tweak)               |

Pick another family by swapping the URL `family=` value and the matching class name:

- `Material+Symbols+Rounded` ↔ `material-symbols-rounded`
- `Material+Symbols+Sharp`   ↔ `material-symbols-sharp`

Browse names at https://fonts.google.com/icons. Use the **icon name** (lowercase, underscores) as the span text, e.g. `play_arrow`, `arrow_forward`, `check_circle`, `bolt`, `rocket_launch`.

**When to prefer Material Symbols over an image asset:**

- UI affordances (play, pause, close, arrows, check marks).
- Decorative accents that should match the layer's text color.
- Anything that needs to scale crisply or animate `color` / `font-size` via keyframes.

Stick with PNG/SVG assets only when the user supplies a specific brand mark or a custom illustration that isn't part of the icon set.

**Render-timing note.** When the project is rendered (not just previewed), Chromium must fetch the font before the frame is captured. Keeping `@import` as the very first rule of the layer CSS is enough in practice — but if you see icons rendered as the literal ligature text in the MP4, move the `@import` to a layer that starts at frame 0 or pre-render once to warm the browser cache.

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
