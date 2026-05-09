# Integración con open-effects

Este archivo es la **regla 2** del skill. La producción técnica del video se hace **siempre con la API de open-effects**, siguiendo el skill canónico `open-effects-video`.

---

## Paso 0 — Cargar el skill canónico de open-effects

**Antes de construir el ProjectJson**, asegúrate de tener cargado el skill `open-effects-video` (vive en este mismo repo en `.claude/skills/open-effects-video/SKILL.md`). Es la fuente autorizada para:

- Subida de assets (`POST /api/assets`, multipart, dedup por SHA-256, máx 200 MB).
- Creación de proyecto (`POST /api/projects`, devuelve `{ id }`).
- PATCH del ProjectJson completo (`PATCH /api/projects/:id`).
- Render (`POST /api/render/:projectId` → SSE `/events` → descarga estática `/renders/...`).
- Reglas de Material Symbols como sistema de iconos.
- OpenAPI vivo: `curl http://localhost:3000/api/openapi.yaml`.
- Schemas Zod: `packages/shared-types/src/schemas/`.

Resumen de lo que ese skill cubre y que debes respetar al pie de la letra para este estilo:

- **Animación** = array `keyframes` por layer, no CSS animations. Cada keyframe es `{ frame, property, value, easingOut }`.
- **Propiedades animables soportadas** (registry en `packages/runtime/src/keyframes/propertyRegistry.ts`):
  - `opacity` (numeric, 0–1).
  - `transform.translateX`, `transform.translateY` (length-px).
  - `transform.scale` (numeric).
  - `transform.rotate` (angle-deg).
  - `color`, `background-color` (color, acepta `#RRGGBB`, `rgba(...)`).
  - `border-radius`, `width`, `height`, `top`, `left` (length-px).
- **Custom keyframes** — para animar texto dinámico (counters, %), propiedades CSS no listadas (`clip-path`, `filter`, gradientes, `stroke-dashoffset`), o un mismo valor reutilizado en varias propiedades: usar `property: "custom.<KEY>"` (con `KEY` en `UPPER_SNAKE_CASE`, regex `^[A-Z][A-Z0-9_]{0,31}$`) y referenciar `$KEY` dentro del HTML/CSS del layer. Interpolación numérica pura — las unidades van pegadas al placeholder en el template (`translateX($POSITION_Xpx)`, `width: $PCT%`). Solo a nivel layer (las scenes no tienen template). Detalle completo en el skill `open-effects-video`.
- **Easings disponibles**: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier { params: [x1,y1,x2,y2] }`, `spring { params: { damping, stiffness, mass } }`.
- **Transiciones de escena**: `scene.transitionIn` admite `none | fade | slide-{left,right,up,down}` con `durationFrames`.
- **fps válidos**: `24 | 30 | 60`. **width/height**: enteros 1..7680. **durationFrames** ≥ 1 por escena.
- **Render** es OPCIONAL — solo dispararlo cuando el usuario lo pida.

---

## Paso 1 — Preparar el proyecto en el servidor

Comprueba que el dev server está corriendo:

```bash
BASE_URL="${BASE_URL:-http://localhost:3000}"
curl -s "$BASE_URL/api/openapi.yaml" > /tmp/oe-openapi.yaml
test -s /tmp/oe-openapi.yaml && echo "server OK"
```

Si el usuario quiere reusar un proyecto existente, pídele el `projectId`. Si va a crear uno nuevo:

```bash
PROJECT_ID=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"<MARCA> — Promo 30s","width":1920,"height":1080,"fps":30}' \
  | jq -r '.id')
echo "$PROJECT_ID"
```

Para **Reels/TikTok/Shorts** usa `width:1080,height:1920`. Para **Stories**, lo mismo. Para **Feed 4:5**, `1080×1350`.

---

## Paso 2 — Subir assets necesarios

Antes de PATCHear el ProjectJson, sube todo lo que vas a referenciar dentro de los layers o `audioTracks`:

| Asset | Cuándo subir | Dónde se usa |
|-------|--------------|--------------|
| Logo claro (para fondo saturado) | Si la marca lo aporta | Layer `<img>` en escenas con fondo primario |
| Logo oscuro (para fondo claro) | Si la marca lo aporta | Layer `<img>` en escenas con fondo claro |
| Voiceover MP3 / WAV | Si lo aporta el cliente o lo generas con TTS externo | `audioTracks` de las escenas habladas |
| Música de fondo | Si la hay | `audioTracks` de todas las escenas |
| Mockups/screenshots de producto | Si el storyboard los usa | Layer `<img>` en escenas de UI fake |

```bash
LOGO_DARK=$(curl -s -X POST "$BASE_URL/api/assets" -F "file=@./logo-dark.svg")
LOGO_DARK_PATH=$(echo "$LOGO_DARK" | jq -r '.path')

LOGO_LIGHT=$(curl -s -X POST "$BASE_URL/api/assets" -F "file=@./logo-light.svg")
LOGO_LIGHT_PATH=$(echo "$LOGO_LIGHT" | jq -r '.path')

# Voiceover (opcional)
VO=$(curl -s -X POST "$BASE_URL/api/assets" -F "file=@./voiceover.mp3")
VO_ID=$(echo "$VO" | jq -r '.id')
VO_PATH=$(echo "$VO" | jq -r '.path')
```

> **Iconos**: para los iconos de feature **prefiere Material Symbols** (sección dedicada en el skill `open-effects-video`). No requieren upload, animan en color/tamaño limpiamente y son consistentes. Solo sube SVGs/PNGs cuando la marca tenga su propio set y la coherencia visual lo exija.

---

## Paso 3 — Conversión ms → frames (lookup table)

Todos los timings del estilo (definidos en `references/animation-grammar.md`) están en milisegundos. Conviértelos al `fps` elegido. **A 30 fps**:

| ms | frames @ 30fps | frames @ 60fps | frames @ 24fps |
|----|----------------|-----------------|----------------|
| 80 | 2 (≈2.4) | 5 | 2 |
| 120 | 4 (≈3.6) | 7 | 3 |
| 200 | 6 | 12 | 5 |
| 300 | 9 | 18 | 7 |
| 350 | 11 (≈10.5) | 21 | 8 |
| 400 | 12 | 24 | 10 |
| 500 | 15 | 30 | 12 |
| 600 | 18 | 36 | 14 |
| 700 | 21 | 42 | 17 |
| 800 | 24 | 48 | 19 |
| 900 | 27 | 54 | 22 |
| 1000 | 30 | 60 | 24 |
| 1500 | 45 | 90 | 36 |
| 2000 | 60 | 120 | 48 |
| 2500 | 75 | 150 | 60 |
| 3000 | 90 | 180 | 72 |
| 4000 | 120 | 240 | 96 |

Por defecto trabaja a **30 fps** salvo que el cliente pida 60 fps explícitamente para movimiento más suave.

Patrón de cálculo en `jq`:
```bash
fps=30
delay_ms=350
delay_frames=$(( delay_ms * fps / 1000 ))   # 10
```

---

## Paso 4 — Esqueleto del ProjectJson para este estilo

Cada escena del storyboard se mapea a un objeto `Scene`. La narrativa de 5 actos / 14 escenas suele dejar este reparto a 30 fps:

| Escena | Acto | Inicio | durationFrames @ 30fps | transitionIn |
|--------|------|--------|------------------------|--------------|
| 01 — Hook | 1 | 0:00 | 120 (4s) | `null` o `none` |
| 02 — Lockup | 2 | 0:04 | 90 (3s) | `{ type: "fade", durationFrames: 12 }` |
| 03 — Solución intro | 3 | 0:07 | 60 (2s) | `{ type: "fade", durationFrames: 12 }` |
| 04 — Feature 1 | 3 | 0:09 | 60 (2s) | `{ type: "fade", durationFrames: 9 }` |
| 05 — Feature 1 demo | 3 | 0:11 | 60 (2s) | `{ type: "slide-left", durationFrames: 12 }` |
| 06 — Cards | 3 | 0:13 | 75 (2.5s) | `{ type: "fade", durationFrames: 9 }` |
| 07 — Feature 3 | 3 | 0:15.5 | 75 (2.5s) | `{ type: "fade", durationFrames: 12 }` |
| 08 — Stat 1 | 4 | 0:18 | 75 (2.5s) | `{ type: "fade", durationFrames: 12 }` |
| 09 — Stat 2 | 4 | 0:20.5 | 75 (2.5s) | `{ type: "fade", durationFrames: 9 }` |
| 10 — Stat 3 | 4 | 0:23 | 75 (2.5s) | `{ type: "fade", durationFrames: 9 }` |
| 11 — CTA | 5 | 0:25.5 | 75 (2.5s) | `{ type: "fade", durationFrames: 12 }` |
| 12 — Demo final | 5 | 0:28 | 60 (2s) | `{ type: "fade", durationFrames: 9 }` |
| 13 — Lockup final | 5 | 0:30 | 60 (2s) | `{ type: "fade", durationFrames: 12 }` |

Total ≈ 32 s. Para un corte exacto de 30 s, recortar las escenas 12 y 13 a 1.5 s cada una (45 frames).

Cada escena lleva:
```jsonc
{
  "id": "scene_01",
  "order": 0,
  "name": "Hook",
  "background": "#E8FAEC",                         // fondo claro derivado del primario
  "durationFrames": 120,                            // 4s a 30fps
  "transitionIn": null,                             // o { type, durationFrames }
  "keyframes": [],                                  // raros — solo para animar el contenedor de escena
  "layers": [ /* … plantillas de open-effects-components.md … */ ],
  "audioTracks": [ /* opcional, ver paso 6 */ ]
}
```

`background` admite cualquier valor CSS válido — HEX, `rgb()`, `linear-gradient(...)`. Para el blob orgánico del estilo, NO lo pongas en `background`; móntalo como un layer SVG dedicado para tener control de keyframes.

---

## Paso 5 — Ensamblar y enviar

La forma recomendada es construir el ProjectJson por escena en archivos `.json` separados, mergearlos con `jq`, y enviar en una sola PATCH. Ejemplo de plantilla mínima inicial:

```bash
cat > /tmp/promo-project.json <<'EOF'
{
  "id": "PROJECT_ID_PLACEHOLDER",
  "name": "MARCA — Promo 30s",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "scenes": [
    /* … se llenan progresivamente … */
  ]
}
EOF

jq --arg pid "$PROJECT_ID" '.id = $pid' /tmp/promo-project.json \
  | curl -s -X PATCH "$BASE_URL/api/projects/${PROJECT_ID}" \
      -H "Content-Type: application/json" --data-binary @-
```

Tras cada PATCH, abre `${BASE_URL}/projects/${PROJECT_ID}` en el navegador para previsualizar. Itera escena a escena.

---

## Paso 6 — Audio (voiceover + música)

Si el cliente quiere voiceover y/o música:

1. Sube los assets (`POST /api/assets`) y guarda `id` y `path`.
2. Cada `audioTrack` vive en una `scene`. Si la pista atraviesa varias escenas, lo más limpio es repetirla con `trimStart`/`trimEnd` recalculados, o dejarla solo en la escena 1 con `startFrame: 0` y `trimEnd` cubriendo toda la duración total — el runtime no recorta automáticamente al final de la escena, pero la práctica recomendada por `open-effects-video` es por-escena.
3. Para "ducking" del voiceover sobre la música, anima `volumeKeyframes` de la pista de música: bajar a `0.3` durante el VO, subir a `0.9` en silencios.

```jsonc
"audioTracks": [
  {
    "id": "track_vo_01",
    "assetId": "<VO_ID>",
    "assetPath": "<VO_PATH>",
    "startFrame": 0,
    "trimStart": 0,
    "trimEnd": 120,
    "eq": null,
    "volumeKeyframes": [
      { "id": "vk_vo_in",  "frame": 0,   "value": 0,   "easingOut": { "type": "ease-out" } },
      { "id": "vk_vo_on",  "frame": 6,   "value": 1,   "easingOut": { "type": "linear" } }
    ]
  }
]
```

> Si el cliente no aporta voiceover y necesita TTS, esto queda fuera del skill — recomienda Eleven Labs / OpenAI TTS y luego el archivo se sube como un asset normal.

---

## Paso 7 — Sanity check

Antes de declarar el video terminado:

1. **Previsualiza en `/projects/<id>` en el navegador** — la edición es live.
2. Recorre la timeline buscando huecos (saltos de fondo sin transition, layers que aparecen sin keyframe inicial → "pop"), y los huecos entre `startFrame`+`durationFrames` consecutivos.
3. Confirma que el primer y último frame de cada escena son los que pretendes (frame 0 = entrada animada, último = estado de salida o handoff a la siguiente).
4. Para canvas vertical (Reels/Stories), inspecciona que NINGÚN texto/icon/píldora cae dentro de los márgenes seguros descritos en SKILL.md.

---

## Paso 8 — Render final (solo si el usuario lo pide)

```bash
RENDER_ID=$(curl -s -X POST "$BASE_URL/api/render/${PROJECT_ID}" | jq -r '.renderId')
# Sigue SSE hasta completed (ver script .claude/skills/open-effects-video/scripts/render-video.sh)
```

Si el cliente quiere variantes de aspect ratio, lo más limpio es **duplicar el proyecto** (POST `/api/projects` con `width`/`height` distintos), recalcular layouts de cada layer (top/left), y disparar otro render. NO hagas un solo proyecto multi-resolución — el ProjectJson tiene `width`/`height` únicos.

---

## Estrategia recomendada al entregar al cliente

No intentes producir las 14 escenas en una sola PATCH gigantesca. Sigue este protocolo:

1. **Iteración 1** — PATCH solo escenas 1, 2 y 3 (Hook, Lockup, Solución intro). Previsualiza y muestra al cliente. Confirma estilo, paleta y ritmo.
2. **Iteración 2** — Añade escenas 4-7 (las features). PATCH completo del bloque 0-18s. Confirma con el cliente.
3. **Iteración 3** — Añade escenas 8-13 (stats + CTA + cierre). PATCH final con las 13/14 escenas. Iteración fina.

Cada PATCH es completa (no parcial): el endpoint reemplaza todo el ProjectJson. Mantén una copia local del JSON de cada iteración por si necesitas rollback.

---

## Checklist antes de cerrar la entrega

- [ ] Los HEX usados en `scene.background` y en el CSS de cada layer coinciden 1:1 con la tabla de tokens de marca (no hay residuos del video analizado).
- [ ] No hay CSS `@keyframes` ni `transition` como animación dentro de los layers — todo el motion vive en el array `keyframes` de cada layer.
- [ ] Cada animación usa easings `cubic-bezier` o `spring` (no `linear`/`ease-*` salvo casos puntuales).
- [ ] Los timings de los keyframes están convertidos a frames consistentes con `fps` del proyecto.
- [ ] El logo en versión clara se usa en escenas con fondo saturado y la oscura en fondo claro.
- [ ] Cada escena tiene `durationFrames` correcto y la suma cubre los 30 s objetivo.
- [ ] Las `transitionIn` están definidas en cada cambio de fondo (claro↔saturado) — no cortes secos.
- [ ] El audio del voiceover (si lo hay) está sincronizado con el storyboard.
- [ ] La preview del editor se ve bien en frame 0 de cada escena, en el medio y al final.

Solo entonces da por entregado el video.

---

## Errores comunes y cómo evitarlos

| Síntoma | Causa | Fix |
|---|---|---|
| Layer "salta" desde un valor inicial extraño al primer keyframe | Falta keyframe en `frame: 0` con el valor inicial | Añadir un keyframe de "estado inicial" antes del de "estado animado" |
| El elemento se ve antes de tiempo | `startFrame` del layer mal puesto, o el primer keyframe de opacity no es 0 | Empezar con keyframe `opacity = 0` en frame 0 + keyframe `opacity = 1` cuando deba aparecer |
| Easing spring se ve "atascado" | `damping` demasiado alto (sin overshoot) | Bajar damping a 10-14, subir stiffness a 100-140 |
| Iconos de Material Symbols salen como texto literal en render | El `@import` no es la primera regla del CSS del layer | Mover `@import` arriba del todo en `layer.css` |
| Crossfade entre escenas se ve seco | Falta `transitionIn` en la siguiente escena | Añadir `{ type: "fade", durationFrames: 9..15 }` |
| Stagger de palabras desincronizado | startFrame de cada layer-palabra no incrementa de forma consistente | Recalcular: `startFrame_palabra_n = startFrame_base + n * stagger_frames` |
| 400 al PATCH | ProjectJson no valida contra Zod | Inspeccionar `error.fieldErrors`, ver `packages/shared-types/src/schemas/` |

---

## Recurso oficial de referencia

Para cualquier duda específica de la API no cubierta aquí:

- `.claude/skills/open-effects-video/SKILL.md` — pipeline canónico, Material Symbols, troubleshooting.
- `apps/web/openapi.yaml` — schema completo (OpenAPI 1.1.0).
- `docs/api/programmatic-guide.md` — versión narrativa de los pasos.
- `docs/api/examples/minimal-project.json` — fixture inicial.
- `packages/shared-types/src/schemas/` — Zod source para Project, Scene, Layer, Keyframe, AudioTrack, Easing.
- `packages/runtime/src/keyframes/propertyRegistry.ts` — lista exacta de propiedades animables.
