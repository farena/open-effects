# Driving open-effects programmatically

## TL;DR

Five HTTP calls produce an MP4 from a JSON description of your video:

1. Upload your assets (audio, images)
2. Create a project (dimensions + fps)
3. PATCH the full `ProjectJson` (scenes, layers, keyframes, audio tracks)
4. POST to start a render (fire-and-forget)
5. Follow SSE progress, then download the MP4

No authentication is required in v1 (single-user local deployment).

---

## Prerequisites

- A running open-effects dev server at `http://localhost:3000`
- `curl` (any recent version)
- FFmpeg installed locally (used by the renderer at step 4)
- An audio file and/or image file to upload (optional — you can create a text-only project)

---

## Step 1 — Upload assets

Upload a file using `multipart/form-data`. The server returns an `Asset` object
with an `id` and `path` you will reference in your `ProjectJson`.

```bash
# Upload an audio track
curl -s -X POST http://localhost:3000/api/assets \
  -F "file=@/path/to/background-music.mp3" | jq .
```

Expected response (`201 Created`):

```json
{
  "id": "asset_clxyz123",
  "type": "audio",
  "filename": "background-music.mp3",
  "path": "/uploads/background-music_clxyz123.mp3",
  "mimeType": "audio/mpeg",
  "size": 4194304,
  "sha256": "e3b0c4..."
}
```

Save the `id` and `path` — you will use them when building the `ProjectJson`.

To list existing assets (optionally filter by type):

```bash
curl -s "http://localhost:3000/api/assets?type=audio" | jq .
```

---

## Step 2 — Create a project

Create a project record with name, canvas dimensions, and frame rate.
The server seeds it with one default empty scene.

```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Video",
    "width": 1280,
    "height": 720,
    "fps": 30
  }' | jq .
```

Expected response (`201 Created`):

```json
{ "id": "proj_clxyz456" }
```

Save the project `id` for subsequent steps.

---

## Step 3 — Define your video (PATCH ProjectJson)

Replace the full `ProjectJson` for the project. This is the source of truth
for the editor and the renderer. The body must conform to `ProjectSchema`
(see `packages/shared-types/src/schemas/project.ts`).

```bash
PROJECT_ID="proj_clxyz456"
ASSET_ID="asset_clxyz123"
ASSET_PATH="/uploads/background-music_clxyz123.mp3"

curl -s -X PATCH "http://localhost:3000/api/projects/${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d @docs/api/examples/minimal-project.json | jq .
```

See `docs/api/examples/minimal-project.json` for a complete working example
with 2 scenes, opacity keyframes, and a fading audio track.

When substituting real asset IDs, update the `assetId` and `assetPath` fields
inside the `audioTracks` arrays in your JSON.

Expected response (`200 OK`):

```json
{ "ok": true }
```

---

## Step 4 — Trigger a render

POST to start the render job. The job runs asynchronously; progress is tracked
via SSE (step 5).

```bash
PROJECT_ID="proj_clxyz456"

curl -s -X POST "http://localhost:3000/api/render/${PROJECT_ID}" | jq .
```

Expected response (`202 Accepted`):

```json
{ "renderId": "render_clxyz789" }
```

Save the `renderId` for the SSE stream.

---

## Step 5 — Follow render progress (SSE)

Open an SSE connection. Each event carries the full `RenderJob` state object.
The stream closes automatically when `status` is `completed` or `error`.

```bash
PROJECT_ID="proj_clxyz456"
RENDER_ID="render_clxyz789"

curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/render/${PROJECT_ID}/${RENDER_ID}/events"
```

Example event stream:

```
data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"pending","percent":0}

data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"running","percent":23}

data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"running","percent":78}

data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"completed","percent":100,"outputPath":"/renders/proj_clxyz456/2026-05-08T12-00-00-000Z.mp4"}
```

When `status` is `completed`, the `outputPath` field contains the public path
of the output MP4.

To handle errors: when `status` is `error`, the `error` field contains a
message. Re-trigger the render by posting to `POST /api/render/{projectId}`
again.

---

## Step 6 — Download the MP4

The output MP4 is served as a static Next.js asset from the `public/renders/`
directory. Construct the download URL from the `outputPath` returned in step 5.

```bash
OUTPUT_PATH="/renders/proj_clxyz456/2026-05-08T12-00-00-000Z.mp4"
FILENAME=$(basename "${OUTPUT_PATH}")

curl -s -o "${FILENAME}" "http://localhost:3000${OUTPUT_PATH}"
echo "Downloaded to ${FILENAME}"
```

To delete a render file from the server:

```bash
PROJECT_ID="proj_clxyz456"
FILENAME="2026-05-08T12-00-00-000Z.mp4"

curl -s -X DELETE \
  "http://localhost:3000/api/projects/${PROJECT_ID}/renders/${FILENAME}" | jq .
```

---

## Worked example (full sequence)

The following script performs steps 1–6 in order, using the minimal project
fixture. It requires `bash`, `curl`, `jq`, and an audio file.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:3000"

# 1. Upload audio asset (optional — remove audioTracks from JSON to skip)
echo "=== Uploading asset..."
ASSET=$(curl -s -X POST "${BASE}/api/assets" -F "file=@/tmp/sample.mp3")
ASSET_ID=$(echo "${ASSET}" | jq -r '.id')
ASSET_PATH=$(echo "${ASSET}" | jq -r '.path')
echo "Asset id=${ASSET_ID} path=${ASSET_PATH}"

# 2. Create project
echo "=== Creating project..."
PROJECT_ID=$(curl -s -X POST "${BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Programmatic Test","width":1280,"height":720,"fps":30}' \
  | jq -r '.id')
echo "Project id=${PROJECT_ID}"

# 3. Patch with full ProjectJson (substituting real asset id/path)
echo "=== Patching ProjectJson..."
jq \
  --arg aid "${ASSET_ID}" \
  --arg ap "${ASSET_PATH}" \
  '.scenes[0].audioTracks[0].assetId = $aid |
   .scenes[0].audioTracks[0].assetPath = $ap |
   .id = "'"${PROJECT_ID}"'"' \
  docs/api/examples/minimal-project.json \
  | curl -s -X PATCH "${BASE}/api/projects/${PROJECT_ID}" \
      -H "Content-Type: application/json" \
      --data-binary @- | jq .

# 4. Start render
echo "=== Starting render..."
RENDER_ID=$(curl -s -X POST "${BASE}/api/render/${PROJECT_ID}" | jq -r '.renderId')
echo "Render id=${RENDER_ID}"

# 5. Follow SSE until done
echo "=== Waiting for render..."
OUTPUT_PATH=""
while IFS= read -r line; do
  if [[ "${line}" == data:* ]]; then
    JOB="${line#data: }"
    STATUS=$(echo "${JOB}" | jq -r '.status')
    PERCENT=$(echo "${JOB}" | jq -r '.percent // 0')
    echo "  [${STATUS}] ${PERCENT}%"
    if [[ "${STATUS}" == "completed" ]]; then
      OUTPUT_PATH=$(echo "${JOB}" | jq -r '.outputPath')
      break
    elif [[ "${STATUS}" == "error" ]]; then
      echo "Render failed: $(echo "${JOB}" | jq -r '.error')"
      exit 1
    fi
  fi
done < <(curl -sN "${BASE}/api/render/${PROJECT_ID}/${RENDER_ID}/events")

# 6. Download
FILENAME=$(basename "${OUTPUT_PATH}")
echo "=== Downloading ${FILENAME}..."
curl -s -o "${FILENAME}" "${BASE}${OUTPUT_PATH}"
echo "Done! Saved to ${FILENAME}"
```

---

## Schema reference

- Full OpenAPI 3.1 spec: `apps/web/openapi.yaml`
- Rendered HTML docs: `docs/api/redoc.html` (open in any browser)
- Runtime spec endpoint: `GET http://localhost:3000/api/openapi.yaml`
- Zod source schemas: `packages/shared-types/src/schemas/`

---

## Limits and gotchas

| Topic | Detail |
|---|---|
| Asset upload max size | 200 MB (enforced by the upload handler) |
| EQ processing | Applied only at render time; the preview plays the raw audio |
| No authentication | v1 is single-user; do not expose the dev server publicly |
| SSE reconnect | The client must reconnect manually if the connection drops; the render job state is preserved in the in-memory registry until the process restarts |
| `process.cwd()` for renders | The render output path is relative to the `apps/web` working directory; in production deployments verify the path resolves correctly |
| Inline examples vs fixture | The inline examples in `openapi.yaml` are human-maintained; the `minimal-project.json` fixture is Zod-validated by a unit test (`tests/docs/minimal-project-fixture.test.ts`) |
