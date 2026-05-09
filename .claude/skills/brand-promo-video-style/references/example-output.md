# Ejemplo completo — aplicación a una marca ficticia

Para calibrar la salida esperada, este es un ejemplo completo del entregable para una marca ficticia. El agente puede usarlo como referencia de tono, longitud y estructura. Recuerda: el video se produce con la **API de open-effects** (PATCH ProjectJson) y la paleta sale de la marca del cliente, NO del video analizado.

---

## Brief recibido

> "Crea un video promo para **TaskFlow**, un gestor de tareas con IA que prioriza tu día. Features: priorización automática, sincronización con calendario, recordatorios inteligentes, modo enfoque. Idioma: español. CTA: Empieza gratis. Color de marca: verde esmeralda `#10B981`. Tipografía: Inter. Logo: aportado en SVG (versión oscura y clara)."

---

## 1. Tokens de marca aplicados

| Rol | HEX | Uso |
|-----|-----|-----|
| Primario saturado | `#10B981` | Fondo de los actos 3 (parte) y 5; iconos en píldora |
| Fondo claro | `#E8FAEC` | Fondo de los actos 1, 2, 4 y partes del 3 |
| Texto oscuro | `#0A1F14` | Sobre fondo claro |
| Texto claro | `#FFFFFF` | Sobre fondo saturado |
| Acento (acto 1) | `#FFC93C` | Icono del problema (amarillo cálido contrastando con el verde frío) |
| Highlight palabra | `#10B981` | Palabra "control" del acto 5 |

**Tipografía**: Inter (peso 500 para features, 600 para hero/CTA), cargada con `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` como primera regla del CSS de los layers que la usan.
**Logo**: SVG aportado por el cliente, en dos versiones (subidas como assets — `logo-dark.svg` para fondos claros, `logo-light.svg` para fondos saturados).

Cliente confirma esta tabla → procedemos al guion.

---

## 2. Guion completo (~70 palabras, 30 s)

```
[ACTO 1 — 0:00–0:04] (ligeramente exasperado)
"Si tu lista de tareas no se acaba nunca, deja de pelearte
 con tu agenda y pásate a TaskFlow."

[ACTO 2 — 0:04–0:07]
[Silencio. Lockup central de marca.]

[ACTO 3 — 0:07–0:22] (confiado, claro)
"Deja que TaskFlow priorice tu día, sincronice tu calendario
 y te avise justo cuando lo necesitas."

[ACTO 4 — 0:22–0:26]
"Recordatorios inteligentes, modo enfoque y sincronización
 con todas tus apps."

[ACTO 5 — 0:26–0:30]
"Recupera el control de tu tiempo. Empieza con TaskFlow gratis hoy."
```

Recuento: 71 palabras. ✓

---

## 3. Storyboard (14 escenas)

| # | Tiempo | Layout | Texto en pantalla | Voiceover | Movimiento clave | Transición salida |
|---|--------|--------|-------------------|-----------|-------------------|-------------------|
| 1 | 0:00–0:04 | Hero claro + caos de tareas | "Si tu [☑️] no se acaba nunca" | "Si tu lista de tareas no se acaba nunca..." | Texto palabra-a-palabra; ~14 píldoras de tarea pendiente flotan con rotación; icono lista amarillo en línea | Tareas fade up + zoom-in al logo |
| 2 | 0:04–0:07 | Lockup central, fondo claro con blob | "TASKFLOW" + sublabel "Pro" | (silencio) | Logo scale 0.6→1.05→1, easing spring | Crossfade fondo claro→verde |
| 3 | 0:07–0:09 | Hero verde | "Deja que tu día" | "Deja que TaskFlow..." | Texto palabra-a-palabra | Fade rápido |
| 4 | 0:09–0:11 | Hero verde + cursor | "Priorice tu día" | "...priorice tu día..." | Texto entra, cursor en arco desde inf-dcha | Push lateral |
| 5 | 0:11–0:13 | Píldora rectangular con borde | "📅 Sincroniza tu calendario" | "...sincronice tu calendario..." | Píldora aparece scale-in, cursor permanece | Crossfade |
| 6 | 0:13–0:15.5 | Cards horizontales (Hoy / Mañana / Esta semana) | Cards con tareas mock | (continúa VO) | 3 cards aparecen stagger 120ms | Push hacia siguiente feature |
| 7 | 0:15.5–0:18 | Notificaciones flotantes pequeñas | "Te avise" en violeta destacado dentro de hero | "...y te avise justo cuando lo necesitas." | Notif inteligentes flotan con rotación leve | Crossfade fondo verde→claro |
| 8 | 0:18–0:20.5 | Píldora con icono (campana) | "Recordatorios inteligentes" | "Recordatorios inteligentes..." | Icono spring-in + texto slide | Píldora se desplaza arriba |
| 9 | 0:20.5–0:23 | Píldora con icono (luna/foco) + animación símbolos | "Modo enfoque" | "...modo enfoque..." | Símbolos de distracciones desvaneciéndose alrededor | Píldora se desplaza arriba |
| 10 | 0:23–0:25.5 | Píldora con icono (refresh) | "Sincronización con todas tus apps" | "...y sincronización con todas tus apps." | Icono spring-in + texto | Crossfade a fondo claro |
| 11 | 0:25.5–0:28 | Hero claro, palabra "control" en verde esmeralda | "Recupera el **control** de tu tiempo" | "Recupera el control de tu tiempo." | Texto palabra-a-palabra, "control" cambia color al aparecer | Fade |
| 12 | 0:28–0:30 | Mockup de TaskFlow priorizando tareas | UI fake con tareas reordenándose | "Empieza con TaskFlow gratis hoy." | Tareas se animan reordenando con flechas indicativas | Zoom-out al lockup |
| 13 | 0:30–0:32 | Lockup final fondo verde saturado | "TASKFLOW" en blanco | (cierre) | Logo scale spring final | (loop opcional) |

**Notas de movimiento:**
- El cursor de ratón aparece en escenas 4, 5 y 6 como elemento narrativo recurrente.
- Las transiciones entre fondos claro↔verde usan crossfade de 400ms con superposición de 100ms.
- La palabra "control" en la escena 11 cambia de `#0A1F14` a `#10B981` con un ligero scale 1→1.05 mientras el resto del texto se mantiene en negro.
- Las cards de la escena 6 muestran el reordenamiento automático: tras aparecer, una de ellas se desplaza visualmente a otra posición indicando la priorización por IA.

---

## 4. Specs técnicas

- **Resolución**: 1920×1080 (16:9) para web/YouTube. Variantes 1080×1920 (9:16) y 1080×1080 (1:1) duplicando el proyecto en open-effects (cada variante es un proyecto distinto con `width`/`height` propios).
- **Frame rate**: 30 fps (`fps: 30` en el ProjectJson). 60 fps opcional para movimiento de spring más suave.
- **Tipografía**: Inter (peso 500 para features, 600 para hero y CTA), cargada en cada layer relevante con `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` como **primera regla** del CSS.
- **Paleta**: ver bloque 1 (Tokens de marca aplicados).
- **Easings (`easingOut` por keyframe)**: `{ "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] }` para entradas; `{ "type": "cubic-bezier", "params": [0.4, 0, 0.2, 1] }` para salidas; cursor con `{ "type": "cubic-bezier", "params": [0.25, 0.46, 0.45, 0.94] }`. Springs nativos con `{ "type": "spring", "params": { "damping": 12, "stiffness": 100, "mass": 0.6 } }` para iconos.
- **Iconos**: Material Symbols Rounded vía `@import` de Google Fonts (`check_box`, `calendar_month`, `subject`, `notifications`, `center_focus_strong`, `sync`).
- **Transiciones de escena**: `scene.transitionIn = { "type": "fade", "durationFrames": 12 }` en cada cambio de fondo; `slide-left` puntual entre escenas 4↔5.
- **Audio**: corporate-tech ambient ~95 BPM en clave menor (subido como asset, en `audioTracks` de cada escena); ducking del VO mediante `volumeKeyframes` en la pista de música (bajada a `0.3` durante el VO, vuelta a `0.9` en silencios); whoosh suave en cada transición.
- **Export**: `POST /api/render/:projectId` → SSE → descarga MP4 H.264 desde `/renders/...`. Bitrate por defecto del runtime.
- **Herramienta**: **API de open-effects** siguiendo el skill `open-effects-video`. Estructura del proyecto y plantillas en `references/open-effects-integration.md` y `references/open-effects-components.md`.

---

## 5. Implementación open-effects (extracto del ProjectJson)

```jsonc
{
  "id": "<PROJECT_ID>",
  "name": "TaskFlow — Promo 30s",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "scenes": [
    {
      "id": "scene_01",
      "order": 0,
      "name": "Hook",
      "background": "#E8FAEC",                /* fondo claro derivado del verde */
      "durationFrames": 120,                  /* 4s @30fps */
      "transitionIn": null,
      "keyframes": [],
      "layers": [
        /* layer_bg_blob — order 1, fill=#10B981 con opacidad 0.15, blur 80 */
        /* layer_logo — order 100, <img src="<DARK_LOGO_PATH>"> top:48 left:48 height:56 */
        /* layer_hero_word_1..7 — order 50, uno por palabra con startFrame 0,2,4,6,8,10,12 */
        /* layer_problem_icon — order 55, Material Symbols "list" en píldora amarilla */
        /* layer_notif_01..08 — order 30, uno por notificación con stagger en startFrame */
      ],
      "audioTracks": [
        {
          "id": "track_vo_01",
          "assetId": "<VO_ASSET_ID>",
          "assetPath": "<VO_ASSET_PATH>",
          "startFrame": 0,
          "trimStart": 0,
          "trimEnd": 120,
          "eq": null,
          "volumeKeyframes": [
            { "id": "vk_in",  "frame": 0,  "value": 0, "easingOut": { "type": "ease-out" } },
            { "id": "vk_on",  "frame": 6,  "value": 1, "easingOut": { "type": "linear" } }
          ]
        }
      ]
    }
    /* escenas 02..13 siguen el mismo patrón, ver references/open-effects-components.md */
  ]
}
```

El resto del proyecto se construye siguiendo los patrones de `references/open-effects-components.md`, sustituyendo solo los HEX, textos e iconos según este brief, y enviando el ProjectJson completo con `PATCH /api/projects/<PROJECT_ID>`.

---

## Notas de adaptación aplicadas

Decisiones de adaptación tomadas para que el lector pueda replicar el razonamiento:

1. **Sustituí el violeta `#6B5CFF` por verde esmeralda `#10B981`** manteniendo saturación alta y luminosidad media.
2. **El fondo claro lavanda `#EEEDFB` → verde muy pálido `#E8FAEC`** derivando del verde esmeralda con S=30%, L=96%.
3. **Mantuve el amarillo `#FFC93C` para el icono del problema** (acto 1) — su rol es contrastar con el primario, no la marca, y el amarillo contrasta bien con verde.
4. **El "icono email amarillo" del video analizado → "icono lista amarillo"** porque el problema cambia (de bandeja saturada → lista de tareas infinita).
5. **Las "notificaciones flotando" del video analizado → "tareas pendientes flotando"** manteniendo la metáfora visual de saturación/caos.
6. **La escena de "IA escribiendo email" del video analizado → escena de "IA reordenando tareas"** porque la feature estrella es la priorización, no la redacción.

Estas adaptaciones mantienen la estructura, ritmo y estética del video analizado al servicio de la nueva marca y producto. Es exactamente la lógica que el agente debe seguir para cualquier brief.
