# curl cookbook — open-effects API

One curl invocation per endpoint with representative request and response.
All examples assume the dev server is running at `http://localhost:3000`.

---

## Health

### `GET /api/health`

```bash
curl -s http://localhost:3000/api/health | jq .
```

**Response 200 (healthy):**

```json
{ "status": "ok", "db": "up" }
```

**Response 503 (degraded):**

```json
{ "status": "degraded", "db": "down" }
```

---

## Projects

### `GET /api/projects`

```bash
curl -s http://localhost:3000/api/projects | jq .
```

**Response 200:**

```json
[
  {
    "id": "proj_clxyz456",
    "name": "My Video",
    "width": 1280,
    "height": 720,
    "fps": 30,
    "updatedAt": "2026-05-08T12:00:00.000Z"
  }
]
```

---

### `POST /api/projects`

```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"New Video","width":1920,"height":1080,"fps":60}' | jq .
```

**Response 201:**

```json
{ "id": "proj_clxyz789" }
```

**Response 400 (validation error):**

```json
{
  "error": {
    "formErrors": [],
    "fieldErrors": {
      "fps": ["Expected 24 | 30 | 60"]
    }
  }
}
```

---

### `GET /api/projects/:id`

```bash
curl -s http://localhost:3000/api/projects/proj_clxyz456 | jq .
```

**Response 200:** Full `ProjectJson` document (see `ProjectSchema`).

**Response 404:**

```json
{ "error": "not_found" }
```

---

### `PATCH /api/projects/:id`

```bash
curl -s -X PATCH http://localhost:3000/api/projects/proj_clxyz456 \
  -H "Content-Type: application/json" \
  -d @docs/api/examples/minimal-project.json | jq .
```

**Response 200:**

```json
{ "ok": true }
```

---

### `DELETE /api/projects/:id`

```bash
curl -s -X DELETE http://localhost:3000/api/projects/proj_clxyz456 | jq .
```

**Response 200:**

```json
{ "ok": true }
```

---

### `GET /api/projects/:id/renders/:filename`

Renders are served as static Next.js assets. Download with:

```bash
curl -s -o output.mp4 \
  "http://localhost:3000/renders/proj_clxyz456/2026-05-08T12-00-00-000Z.mp4"
```

---

### `DELETE /api/projects/:id/renders/:filename`

```bash
curl -s -X DELETE \
  "http://localhost:3000/api/projects/proj_clxyz456/renders/2026-05-08T12-00-00-000Z.mp4" \
  | jq .
```

**Response 200:**

```json
{ "ok": true }
```

**Response 400 (invalid filename):**

```json
{ "error": "invalid_filename" }
```

---

## Assets

### `GET /api/assets`

```bash
# All assets
curl -s http://localhost:3000/api/assets | jq .

# Filter by type
curl -s "http://localhost:3000/api/assets?type=audio" | jq .
```

**Response 200:**

```json
[
  {
    "id": "asset_clxyz123",
    "type": "audio",
    "filename": "background-music.mp3",
    "path": "/uploads/background-music_clxyz123.mp3",
    "mimeType": "audio/mpeg",
    "size": 4194304
  }
]
```

---

### `POST /api/assets` (upload)

```bash
curl -s -X POST http://localhost:3000/api/assets \
  -F "file=@/path/to/background-music.mp3" | jq .
```

**Response 201:**

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

**Response 400 (no file):**

```json
{ "error": "missing_file" }
```

---

### `DELETE /api/assets/:id`

```bash
curl -s -X DELETE http://localhost:3000/api/assets/asset_clxyz123 | jq .
```

**Response 200:**

```json
{ "ok": true }
```

**Response 409 (asset in use):**

```json
{ "error": "in_use", "refs": 2 }
```

---

## Components

### `GET /api/components`

```bash
# All components
curl -s http://localhost:3000/api/components | jq .

# Filter by category
curl -s "http://localhost:3000/api/components?category=overlays" | jq .
```

**Response 200:**

```json
[
  {
    "id": "comp_01",
    "name": "Red Badge",
    "category": "overlays",
    "preview": "/components/comp_01/preview.png",
    "payload": {
      "layers": [{ "id": "layer_01", "order": 0, "name": "Badge", ... }]
    },
    "createdAt": "2026-05-08T12:00:00.000Z"
  }
]
```

---

### `POST /api/components`

```bash
curl -s -X POST http://localhost:3000/api/components \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Red Badge",
    "category": "overlays",
    "preview": null,
    "payload": {
      "layers": [{
        "id": "layer_01",
        "order": 0,
        "name": "Badge",
        "html": "<div class=\"badge\">NEW</div>",
        "css": ".badge { background: red; color: white; padding: 4px 8px; }",
        "startFrame": 0,
        "endFrame": 59,
        "visible": true,
        "keyframes": []
      }]
    }
  }' | jq .
```

**Response 201:**

```json
{
  "id": "comp_01",
  "name": "Red Badge",
  "category": "overlays",
  "preview": null,
  "payload": { "layers": [...] },
  "createdAt": "2026-05-08T12:00:00.000Z"
}
```

---

### `DELETE /api/components/:id`

```bash
curl -s -X DELETE http://localhost:3000/api/components/comp_01 | jq .
```

**Response 200:**

```json
{ "ok": true }
```

---

## Renders

### `POST /api/render/:projectId`

```bash
curl -s -X POST http://localhost:3000/api/render/proj_clxyz456 | jq .
```

**Response 202:**

```json
{ "renderId": "render_clxyz789" }
```

---

### `GET /api/render/:projectId/:renderId/events` (SSE)

```bash
curl -N http://localhost:3000/api/render/proj_clxyz456/render_clxyz789/events
```

**Stream output:**

```
data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"pending","percent":0}

data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"running","percent":42}

data: {"id":"render_clxyz789","projectId":"proj_clxyz456","status":"completed","percent":100,"outputPath":"/renders/proj_clxyz456/2026-05-08T12-00-00-000Z.mp4"}
```

---

### `GET /api/render/eq-asset/:filename`

Internal endpoint used by the renderer to serve EQ-processed audio files.
Not intended for direct use by API consumers.

```bash
curl -s -o processed.mp3 \
  "http://localhost:3000/api/render/eq-asset/background-music_eq.mp3"
```

---

## OpenAPI spec

### `GET /api/openapi.yaml`

```bash
curl -s http://localhost:3000/api/openapi.yaml
```

Returns the full OpenAPI 3.1 spec as `application/yaml`.
