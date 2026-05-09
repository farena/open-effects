# Componentes open-effects — plantillas reutilizables

Plantillas concretas de **layers + keyframes** para cada elemento del estilo. Cada plantilla está pensada para insertarse dentro de un `scene.layers[]` de un ProjectJson de open-effects.

**Antes de usar este archivo**, debes haber leído `references/open-effects-integration.md` y, idealmente, tener cargado el skill canónico `open-effects-video`.

---

## Convenciones de las plantillas

- `<TOKENS.*>` = sustituir por el HEX/fuente real derivado de `references/brand-tokens.md`.
- `<FRAME_*>` = sustituir por un entero (frame absoluto dentro de la escena, NO de toda la timeline).
- Todos los timings se calculan a **30 fps** salvo que se indique. A 60 fps multiplicar `frame` ×2.
- `id` de keyframes y layers debe ser único dentro de la escena. Convención: `kf_<layerSlug>_<n>`, `layer_<slug>`.
- El layer container ocupa `position: absolute; inset: 0` por defecto (lo aplica el runtime). El contenido HTML se posiciona dentro con CSS.
- **Nunca** uses CSS `transition` o `@keyframes` para animar el contenido del layer — anima vía el array `keyframes` del layer (que actúa sobre el contenedor exterior). El estilo CSS interno es solo para layout estático.

---

## Tabla de propiedades animables (memoria rápida)

Solo estas propiedades pueden ir en `keyframe.property`:

| property | type | unidad de `value` | rango |
|---|---|---|---|
| `opacity` | numeric | `"0"`–`"1"` | 0–1 |
| `transform.translateX` | length-px | `"-20px"`, `"100px"` | libre |
| `transform.translateY` | length-px | `"20px"`, `"-30px"` | libre |
| `transform.scale` | numeric | `"1"`, `"1.05"` | >0 |
| `transform.rotate` | angle-deg | `"-3deg"`, `"5deg"` | libre |
| `color` | color | `"#1A1A2E"`, `"rgba(...)"` | — |
| `background-color` | color | idem | — |
| `border-radius` | length-px | `"12px"` | libre |
| `width`, `height` | length-px | `"280px"` | libre |
| `top`, `left` | length-px | `"100px"` | libre |

Para todo lo demás (filter, blur dinámico, clip-path, etc.) NO hay animación nativa — usa cambios de estado entre escenas o múltiples layers que se solapan.

---

## 1) Logo persistente (esquina superior izquierda)

Usa este layer en TODAS las escenas excepto los lockups centrales.

```jsonc
{
  "id": "layer_logo",
  "order": 100,
  "name": "Logo",
  "html": "<img src=\"<TOKENS.LOGO_DARK_PATH>\" class=\"brand-logo\" />",
  "css": ".brand-logo { position: absolute; top: 48px; left: 48px; height: 56px; width: auto; }",
  "startFrame": 0,
  "endFrame": 119,
  "visible": true,
  "keyframes": []
}
```

- En escenas con fondo saturado, sustituir `LOGO_DARK_PATH` por `LOGO_LIGHT_PATH`.
- Si el logo es solo texto (wordmark), reemplazar `<img>` por `<span class="brand-wordmark">MARCA</span>` con la fuente de marca.
- Para Reels/Stories (1080×1920), top: `~280px`, left: `~80px` para respetar safe area.

---

## 2) Hero text — animación palabra-a-palabra (kinetic typography)

Este es el patrón crítico del estilo. **Cada palabra es un layer independiente**, con su propio `startFrame` desplazado en el stagger. Eso reemplaza el `nth-child` del demo HTML.

Para una frase de 7 palabras con stagger 80ms (≈2 frames @30fps), entrada 500ms (15 frames):

```jsonc
{
  "id": "layer_hero_word_1",
  "order": 50,
  "name": "Hero — palabra 1 (Si)",
  "html": "<div class=\"hero-row\"><span class=\"word\">Si</span></div>",
  "css": ".hero-row { position: absolute; top: 35%; left: 0; width: 100%; text-align: center; font-family: <TOKENS.FONT_FAMILY>, system-ui, sans-serif; font-weight: 600; font-size: 96px; letter-spacing: -1.5px; line-height: 1.15; color: <TOKENS.TEXT_DARK>; } .hero-row .word { display: inline-block; margin-right: 0.25em; }",
  "startFrame": 0,
  "endFrame": 119,
  "visible": true,
  "keyframes": [
    { "id": "kf_w1_o0", "frame": 0,  "property": "opacity",            "value": "0",     "easingOut": { "type": "linear" } },
    { "id": "kf_w1_t0", "frame": 0,  "property": "transform.translateY", "value": "20px", "easingOut": { "type": "linear" } },
    { "id": "kf_w1_o1", "frame": 15, "property": "opacity",            "value": "1",     "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_w1_t1", "frame": 15, "property": "transform.translateY", "value": "0px",  "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } }
  ]
}
```

Para la palabra `n` (índice base 0), el startFrame del primer keyframe es `n * 2`. La duración de la entrada se mantiene en 15 frames. Es decir, la palabra 4 ("se") empieza opacidad 0 en frame 8 y llega a 1 en frame 23.

> **Truco para alineación horizontal**: en lugar de un layer por palabra (que rompe el flow inline), una alternativa más simple es **un solo layer** con todas las palabras en `<span>` y los keyframes aplicados al **layer entero** (entrada uniforme). Pierdes el stagger palabra-a-palabra. Para conservar el stagger genuino, lo correcto es N layers o **renderizar un layer por línea** y aceptar que el stagger en pantalla es el de la línea, no el de cada palabra.
>
> **Compromiso recomendado**: usa **un layer por palabra** posicionado con `position: absolute; left: <x>%; top: 35%` calculado a mano (o con un script que mida ancho aproximado por palabra). Es más laborioso pero da el efecto exacto.

### Variante: una palabra destacada en color highlight (acto 5)

Cuando una palabra clave del CTA cambia de color (ej. "control" en `#10B981`):

```jsonc
{
  "id": "layer_hero_word_highlight",
  "order": 51,
  "name": "Hero — palabra destacada",
  "html": "<div class=\"hero-row\"><span class=\"word emphasis\">control</span></div>",
  "css": ".hero-row { position: absolute; top: 35%; left: 0; width: 100%; text-align: center; font-family: <TOKENS.FONT_FAMILY>; font-weight: 600; font-size: 96px; line-height: 1.15; } .hero-row .word.emphasis { display: inline-block; color: <TOKENS.PRIMARY>; }",
  "startFrame": 0,
  "endFrame": 75,
  "visible": true,
  "keyframes": [
    { "id": "kf_em_o0", "frame": 0,  "property": "opacity",            "value": "0",      "easingOut": { "type": "linear" } },
    { "id": "kf_em_t0", "frame": 0,  "property": "transform.translateY", "value": "20px",  "easingOut": { "type": "linear" } },
    { "id": "kf_em_s0", "frame": 0,  "property": "transform.scale",    "value": "0.95",   "easingOut": { "type": "linear" } },
    { "id": "kf_em_o1", "frame": 18, "property": "opacity",            "value": "1",      "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_em_t1", "frame": 18, "property": "transform.translateY", "value": "0px",   "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_em_s1", "frame": 18, "property": "transform.scale",    "value": "1.05",   "easingOut": { "type": "cubic-bezier", "params": [0.68, -0.55, 0.27, 1.55] } }
  ]
}
```

---

## 3) Píldora con icono (feature) — Material Symbols

Patrón canónico para los actos 3 y 4. Tres sub-elementos animados con stagger, pero como un único layer es difícil escalar el círculo y el texto independientemente, lo más limpio es **dos layers**:

### 3a — Layer del círculo+icono

```jsonc
{
  "id": "layer_pill_circle_dominio",
  "order": 60,
  "name": "Píldora — círculo+icono dominio",
  "html": "<div class=\"pill-icon\"><span class=\"material-symbols-rounded\">public</span></div>",
  "css": "@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'); .pill-icon { position: absolute; top: 50%; left: calc(50% - 220px); width: 120px; height: 120px; margin-top: -60px; border-radius: 50%; background: <TOKENS.PRIMARY>; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 32px <TOKENS.PRIMARY_RGBA_25>; } .pill-icon .material-symbols-rounded { color: #fff; font-size: 64px; font-variation-settings: 'FILL' 0, 'wght' 500; }",
  "startFrame": 0,
  "endFrame": 60,
  "visible": true,
  "keyframes": [
    { "id": "kf_pic_s0", "frame": 0,  "property": "transform.scale", "value": "0",   "easingOut": { "type": "linear" } },
    { "id": "kf_pic_o0", "frame": 0,  "property": "opacity",         "value": "0",   "easingOut": { "type": "linear" } },
    { "id": "kf_pic_o1", "frame": 6,  "property": "opacity",         "value": "1",   "easingOut": { "type": "cubic-bezier", "params": [0.4, 0, 0.2, 1] } },
    { "id": "kf_pic_s1", "frame": 18, "property": "transform.scale", "value": "1",   "easingOut": { "type": "spring", "params": { "damping": 10, "stiffness": 120, "mass": 0.6 } } }
  ]
}
```

> **Recordatorio crítico**: el `@import` de Material Symbols **debe ser la primera regla** del CSS del layer (especificación CSS). El sanitizer de open-effects respeta `@import` at-rules.

### 3b — Layer del texto de la feature

```jsonc
{
  "id": "layer_pill_text_dominio",
  "order": 61,
  "name": "Píldora — texto dominio",
  "html": "<div class=\"pill-text\">Dominio gratis</div>",
  "css": ".pill-text { position: absolute; top: 50%; left: calc(50% - 60px); transform-origin: left center; font-family: <TOKENS.FONT_FAMILY>; font-weight: 500; font-size: 72px; color: <TOKENS.TEXT_DARK>; line-height: 1.1; margin-top: -36px; letter-spacing: -0.5px; white-space: nowrap; }",
  "startFrame": 0,
  "endFrame": 60,
  "visible": true,
  "keyframes": [
    { "id": "kf_pt_o0", "frame": 0,  "property": "opacity",            "value": "0",     "easingOut": { "type": "linear" } },
    { "id": "kf_pt_x0", "frame": 0,  "property": "transform.translateX", "value": "-20px", "easingOut": { "type": "linear" } },
    { "id": "kf_pt_o1", "frame": 11, "property": "opacity",            "value": "0",     "easingOut": { "type": "linear" } },
    { "id": "kf_pt_o2", "frame": 25, "property": "opacity",            "value": "1",     "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_pt_x1", "frame": 25, "property": "transform.translateX", "value": "0px",  "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } }
  ]
}
```

El doble keyframe a frame 11 con valor `0` mantiene el texto invisible hasta el delay de 350ms (≈11 frames @30fps), luego entra en frame 25 (550ms).

> Para un fondo saturado (escena con `background = TOKENS.PRIMARY`), cambia `color: <TOKENS.TEXT_DARK>` por `color: #FFFFFF` y la sombra del círculo por una más blanca/glow para que destaque.

---

## 4) Cursor de ratón animado

Layer SVG inline con keyframes en `transform.translateX/Y` y `opacity`. El movimiento en arco se logra con dos keyframes intermedios.

```jsonc
{
  "id": "layer_cursor",
  "order": 90,
  "name": "Cursor de ratón",
  "html": "<svg class=\"cursor\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 3 L5 18 L9 14 L11.5 19.5 L14 18.5 L11.5 13 L17 13 Z\" fill=\"<TOKENS.TEXT_DARK>\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/></svg>",
  "css": ".cursor { position: absolute; bottom: -60px; right: -60px; width: 48px; height: 48px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); }",
  "startFrame": 12,
  "endFrame": 60,
  "visible": true,
  "keyframes": [
    { "id": "kf_cur_o0", "frame": 0,  "property": "opacity",            "value": "0",       "easingOut": { "type": "linear" } },
    { "id": "kf_cur_x0", "frame": 0,  "property": "transform.translateX", "value": "0px",    "easingOut": { "type": "linear" } },
    { "id": "kf_cur_y0", "frame": 0,  "property": "transform.translateY", "value": "0px",    "easingOut": { "type": "linear" } },
    { "id": "kf_cur_o1", "frame": 9,  "property": "opacity",            "value": "1",       "easingOut": { "type": "cubic-bezier", "params": [0.25, 0.46, 0.45, 0.94] } },
    { "id": "kf_cur_x1", "frame": 24, "property": "transform.translateX", "value": "-700px", "easingOut": { "type": "cubic-bezier", "params": [0.25, 0.46, 0.45, 0.94] } },
    { "id": "kf_cur_y1", "frame": 24, "property": "transform.translateY", "value": "-450px", "easingOut": { "type": "cubic-bezier", "params": [0.25, 0.46, 0.45, 0.94] } }
  ]
}
```

- El cursor empieza fuera del frame (esquina inferior derecha) gracias al `bottom/right: -60px` en CSS, y entra hacia su destino con keyframes negativos en X/Y.
- Para un click implícito, añade tres keyframes consecutivos en `transform.scale`: `1` → `0.85` → `1` con 3 frames de separación cada uno.
- El "bounce idle" tras llegar (oscilación de ±3px) requiere keyframes ping-pong manuales — opcional.

---

## 5) Blob de fondo orgánico

Layer SVG inline con dos elipses y filtro de blur. Va de fondo en escenas con fondo claro.

```jsonc
{
  "id": "layer_bg_blob",
  "order": 1,
  "name": "Blob orgánico de fondo",
  "html": "<svg class=\"bg-blob\" viewBox=\"0 0 1920 1080\" preserveAspectRatio=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><defs><filter id=\"blob-blur\"><feGaussianBlur stdDeviation=\"80\"/></filter></defs><ellipse cx=\"1340\" cy=\"918\" rx=\"560\" ry=\"320\" fill=\"<TOKENS.PRIMARY>\" opacity=\"0.15\" filter=\"url(#blob-blur)\"/><ellipse cx=\"288\" cy=\"216\" rx=\"340\" ry=\"240\" fill=\"<TOKENS.PRIMARY>\" opacity=\"0.10\" filter=\"url(#blob-blur)\"/></svg>",
  "css": ".bg-blob { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }",
  "startFrame": 0,
  "endFrame": 120,
  "visible": true,
  "keyframes": [
    { "id": "kf_blob_x0", "frame": 0,   "property": "transform.translateX", "value": "0px",   "easingOut": { "type": "ease-in-out" } },
    { "id": "kf_blob_x1", "frame": 60,  "property": "transform.translateX", "value": "30px",  "easingOut": { "type": "ease-in-out" } },
    { "id": "kf_blob_x2", "frame": 120, "property": "transform.translateX", "value": "0px",   "easingOut": { "type": "ease-in-out" } }
  ]
}
```

Drift sutil entre frames 0–60–120 (ping-pong). Si la escena dura menos, ajusta los frames intermedios.

---

## 6) Notificación flotante (caos del acto 1)

Una "nube de notificaciones" típicamente requiere ~12-16 layers, uno por notificación, cada uno con `startFrame` desplazado por el stagger (60-80ms entre ellas).

Plantilla de UNA notificación (replica con posiciones, rotaciones y delays distintos):

```jsonc
{
  "id": "layer_notif_03",
  "order": 30,
  "name": "Notif — propuesta aprobada",
  "html": "<div class=\"notif\"><span class=\"dot dot-green\"></span><span class=\"notif-text\">Propuesta aprobada</span></div>",
  "css": ".notif { position: absolute; left: 20%; top: 75%; transform: translate(-50%, -50%) rotate(-2deg); background: #fff; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 24px rgba(<TOKENS.TEXT_DARK_RGB>, 0.10); font-family: <TOKENS.FONT_FAMILY>; font-size: 18px; font-weight: 500; color: #555; white-space: nowrap; } .notif .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; } .notif .dot-green { background: #51cf66; } .notif .dot-red { background: #ff6b6b; } .notif .dot-yellow { background: <TOKENS.ACCENT>; }",
  "startFrame": 27,
  "endFrame": 119,
  "visible": true,
  "keyframes": [
    { "id": "kf_nf3_o0", "frame": 0,  "property": "opacity",         "value": "0",    "easingOut": { "type": "linear" } },
    { "id": "kf_nf3_s0", "frame": 0,  "property": "transform.scale", "value": "0.8",  "easingOut": { "type": "linear" } },
    { "id": "kf_nf3_o1", "frame": 21, "property": "opacity",         "value": "0.95", "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_nf3_s1", "frame": 21, "property": "transform.scale", "value": "1",    "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } }
  ]
}
```

> **Limitación**: open-effects compone `transform.translateX/Y/scale/rotate` automáticamente (ver `composeTransform.test.ts`), pero el `transform: rotate(-2deg)` definido en el CSS del layer convive con los keyframes. Si quieres ANIMAR la rotación, define `transform.rotate` como keyframe en lugar de hardcodearla en CSS.

Salida de notificaciones (al pasar al lockup): añade keyframes hacia `opacity: 0` y `transform.translateY: -40px` antes del corte de escena.

---

## 7) Card de UI fake (acto 3)

Cards horizontales tipo "Urgente / Trabajo / Personal". Uno por card, posicionadas con `left` distinto.

```jsonc
{
  "id": "layer_card_urgente",
  "order": 40,
  "name": "Card — Urgente",
  "html": "<div class=\"ui-card\"><div class=\"card-header\">Urgente</div><div class=\"card-row\"><span class=\"check\"></span><span class=\"line\"></span></div><div class=\"card-row\"><span class=\"check\"></span><span class=\"line\"></span></div><div class=\"card-row\"><span class=\"check\"></span><span class=\"line\"></span></div><div class=\"card-row\"><span class=\"check\"></span><span class=\"line\"></span></div></div>",
  "css": ".ui-card { position: absolute; top: 50%; left: calc(50% - 460px); width: 280px; padding: 24px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(<TOKENS.TEXT_DARK_RGB>, 0.08); font-family: <TOKENS.FONT_FAMILY>; transform: translateY(-50%); } .ui-card .card-header { font-size: 22px; font-weight: 500; color: <TOKENS.TEXT_DARK>; margin-bottom: 18px; } .ui-card .card-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; } .ui-card .check { width: 18px; height: 18px; border: 1.5px solid #ccc; border-radius: 4px; flex-shrink: 0; } .ui-card .line { height: 8px; flex: 1; background: #e5e5ec; border-radius: 4px; }",
  "startFrame": 3,
  "endFrame": 75,
  "visible": true,
  "keyframes": [
    { "id": "kf_c1_o0", "frame": 0,  "property": "opacity",            "value": "0",    "easingOut": { "type": "linear" } },
    { "id": "kf_c1_y0", "frame": 0,  "property": "transform.translateY", "value": "30px", "easingOut": { "type": "linear" } },
    { "id": "kf_c1_o1", "frame": 18, "property": "opacity",            "value": "1",    "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_c1_y1", "frame": 18, "property": "transform.translateY", "value": "0px",  "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } }
  ]
}
```

Para una segunda card desplazada 120ms (4 frames @30fps): `startFrame: 7`. Tercera: `startFrame: 11`. Cambia `left` a `calc(50% - 140px)` y `calc(50% + 180px)` respectivamente.

> **Sobre el `transform: translateY(-50%)` del CSS estático**: como los keyframes también animan `transform.translateY`, hay un conflicto potencial — el runtime compone los sub-properties (`translateX`, `translateY`, `scale`, `rotate`) en un único `transform`, pero el `transform` del CSS estático se sobrescribe. Para centrar verticalmente sin depender de `translateY`, usa `top: calc(50% - 140px)` (la mitad de la altura visual de la card) y deja el keyframe de `translateY` libre.

---

## 8) Lockup central (acto 2 y 5 final)

Logo grande centrado. Suele ser un solo layer con scale-spring entry.

```jsonc
{
  "id": "layer_lockup_center",
  "order": 50,
  "name": "Lockup central",
  "html": "<img src=\"<TOKENS.LOGO_DARK_PATH>\" class=\"lockup\" />",
  "css": ".lockup { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); height: 220px; width: auto; }",
  "startFrame": 0,
  "endFrame": 90,
  "visible": true,
  "keyframes": [
    { "id": "kf_lk_s0", "frame": 0,  "property": "transform.scale", "value": "0.6", "easingOut": { "type": "linear" } },
    { "id": "kf_lk_o0", "frame": 0,  "property": "opacity",         "value": "0",   "easingOut": { "type": "linear" } },
    { "id": "kf_lk_s1", "frame": 12, "property": "transform.scale", "value": "1.05","easingOut": { "type": "cubic-bezier", "params": [0.68, -0.55, 0.27, 1.55] } },
    { "id": "kf_lk_o1", "frame": 12, "property": "opacity",         "value": "1",   "easingOut": { "type": "cubic-bezier", "params": [0.4, 0, 0.2, 1] } },
    { "id": "kf_lk_s2", "frame": 21, "property": "transform.scale", "value": "1",   "easingOut": { "type": "cubic-bezier", "params": [0.4, 0, 0.2, 1] } }
  ]
}
```

> **Conflicto translate del CSS vs keyframes**: como antes, `transform: translate(-50%, -50%)` del CSS se pierde si los keyframes tocan `transform.scale`. Truco: en lugar de centrar con translate, usa `margin-top: -110px; margin-left: <-mitad-del-ancho-real-px>;` o un wrapper externo. Otra alternativa: dimensiona el `<img>` y usa `top: calc(50% - 110px); left: calc(50% - <mitad-ancho-px>);` directamente.

Para el lockup final sobre fondo saturado, sustituye `LOGO_DARK_PATH` por `LOGO_LIGHT_PATH` y la escena lleva `background: <TOKENS.PRIMARY>`.

---

## 9) "Ícono del problema" del acto 1 (color acento)

Un icono cálido (típicamente amarillo) embebido en la frase hero, que sustituye a un sustantivo. Layer separado posicionado en línea con la palabra que reemplaza.

```jsonc
{
  "id": "layer_problem_icon",
  "order": 55,
  "name": "Icono del problema (acto 1)",
  "html": "<div class=\"prob-icon\"><span class=\"material-symbols-rounded\">mail</span></div>",
  "css": "@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'); .prob-icon { position: absolute; top: 35%; left: 50%; transform: translateX(-50%); width: 96px; height: 96px; border-radius: 24px; background: <TOKENS.ACCENT>; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(<TOKENS.ACCENT_RGB>, 0.35); } .prob-icon .material-symbols-rounded { color: <TOKENS.TEXT_DARK>; font-size: 56px; font-variation-settings: 'FILL' 1, 'wght' 600; }",
  "startFrame": 4,
  "endFrame": 119,
  "visible": true,
  "keyframes": [
    { "id": "kf_pi_o0", "frame": 0,  "property": "opacity",         "value": "0",   "easingOut": { "type": "linear" } },
    { "id": "kf_pi_s0", "frame": 0,  "property": "transform.scale", "value": "0.5", "easingOut": { "type": "linear" } },
    { "id": "kf_pi_o1", "frame": 12, "property": "opacity",         "value": "1",   "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "id": "kf_pi_s1", "frame": 12, "property": "transform.scale", "value": "1",   "easingOut": { "type": "spring", "params": { "damping": 10, "stiffness": 120, "mass": 0.6 } } }
  ]
}
```

> Mismo conflicto: el `transform: translateX(-50%)` del CSS se pierde cuando keyframes tocan `transform.scale`. Solución: usa `left: calc(50% - 48px)` directamente y deja el keyframe libre para escala.

---

## Cómo encajar todo dentro de una `Scene`

Ejemplo completo de la **Escena 01 — Hook** (4s, 120 frames @30fps), con el blob, hero word-by-word (resumido a 1 layer "frase entera" en aras de la brevedad de este ejemplo), icono del problema y unas cuantas notificaciones:

```jsonc
{
  "id": "scene_01",
  "order": 0,
  "name": "Hook",
  "background": "<TOKENS.BG_LIGHT>",
  "durationFrames": 120,
  "transitionIn": null,
  "keyframes": [],
  "layers": [
    /* layer_bg_blob (order 1) */,
    /* layer_logo (order 100) */,
    /* layer_hero_word_1 .. layer_hero_word_7 (order 50) — uno por palabra */,
    /* layer_problem_icon (order 55) */,
    /* layer_notif_01 .. layer_notif_08 (order 30) — stagger en startFrame */
  ],
  "audioTracks": []
}
```

Y la **Escena 04 — Feature 1** (2s, 60 frames @30fps) con fondo saturado:

```jsonc
{
  "id": "scene_04",
  "order": 3,
  "name": "Feature 1 — Dominio gratis",
  "background": "<TOKENS.PRIMARY>",
  "durationFrames": 60,
  "transitionIn": { "type": "fade", "durationFrames": 9 },
  "keyframes": [],
  "layers": [
    /* layer_logo (logo-light variant) */,
    /* layer_pill_circle_dominio */,
    /* layer_pill_text_dominio (color: #FFFFFF en CSS porque fondo saturado) */,
    /* layer_cursor (entryDelay 0.4s = startFrame 12) */
  ],
  "audioTracks": []
}
```

---

## Cheatsheet — easings del estilo, en formato open-effects

| Caso | `easingOut` |
|------|-------------|
| Spring entrada (texto, cards, píldoras) | `{ "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] }` o `{ "type": "spring", "params": { "damping": 12, "stiffness": 100, "mass": 0.6 } }` |
| Spring fuerte (iconos en píldora, "pop" del lockup) | `{ "type": "cubic-bezier", "params": [0.68, -0.55, 0.27, 1.55] }` o `{ "type": "spring", "params": { "damping": 10, "stiffness": 120, "mass": 0.6 } }` |
| Salida suave (fade out, scale 1→0.95) | `{ "type": "cubic-bezier", "params": [0.4, 0, 0.2, 1] }` |
| Cursor (movimiento en arco) | `{ "type": "cubic-bezier", "params": [0.25, 0.46, 0.45, 0.94] }` |
| Crossfade entre escenas | `{ "type": "cubic-bezier", "params": [0.4, 0, 0.6, 1] }` |
| Hold (mantener un valor) | `{ "type": "linear" }` (entre dos keyframes con el mismo `value`) |

> NO uses `{ type: "ease-in" }`, `{ type: "ease-out" }` ni `{ type: "ease-in-out" }` por nombre — son demasiado planos para este estilo. Sí están bien para drift de blobs o curvas idle de elementos secundarios.

---

## Recordatorio: lo PROHIBIDO en open-effects para este estilo

```jsonc
// ❌ MAL — la animación CSS no es la primitiva nativa
{
  "html": "<div class='word'>Si</div>",
  "css": ".word { animation: word-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both; } @keyframes word-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }",
  "keyframes": []
}

// ✅ BIEN — la animación vive en `keyframes`
{
  "html": "<div class='word'>Si</div>",
  "css": ".word { font-family: Inter; font-size: 96px; font-weight: 600; }",
  "keyframes": [
    { "frame": 0,  "property": "opacity",            "value": "0",    "easingOut": { "type": "linear" } },
    { "frame": 0,  "property": "transform.translateY", "value": "20px", "easingOut": { "type": "linear" } },
    { "frame": 15, "property": "opacity",            "value": "1",    "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } },
    { "frame": 15, "property": "transform.translateY", "value": "0px",  "easingOut": { "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] } }
  ]
}
```

El demo HTML de `assets/demo-reference.html` SÍ usa CSS animations: solo es para enseñar el estilo en navegador rápidamente, **nunca debe ser el código de producción del video** — la producción son layers + keyframes en el ProjectJson.

---

## Helpers — generar plantillas con `jq`

### Hero text con N palabras

Para ahorrar copy-paste, este snippet `jq` genera N layers de palabras con stagger automático:

```bash
WORDS='["Si","tu","email","se","te","hace","pesado"]'
STAGGER=2          # frames entre palabras (≈80ms @30fps)
ENTER=15           # frames de duración de la entrada
SCENE_DUR=120
COLOR='#0A1F14'
FONT='Inter'

echo "$WORDS" | jq -c --argjson stagger "$STAGGER" --argjson enter "$ENTER" --argjson dur "$SCENE_DUR" --arg color "$COLOR" --arg font "$FONT" '
  to_entries | map(
    {
      id: ("layer_hero_word_" + (.key|tostring)),
      order: 50,
      name: ("Hero — palabra " + (.key+1|tostring) + " (" + .value + ")"),
      html: ("<div class=\"hero-row\"><span class=\"word\">" + .value + "</span></div>"),
      css: (".hero-row { position: absolute; top: 35%; left: 0; width: 100%; text-align: center; font-family: " + $font + "; font-weight: 600; font-size: 96px; color: " + $color + "; line-height: 1.15; } .hero-row .word { display: inline-block; }"),
      startFrame: 0,
      endFrame: ($dur - 1),
      visible: true,
      keyframes: [
        { id: ("kf_w" + (.key|tostring) + "_o0"), frame: (.key * $stagger),          property: "opacity",            value: "0",     easingOut: { type: "linear" } },
        { id: ("kf_w" + (.key|tostring) + "_t0"), frame: (.key * $stagger),          property: "transform.translateY", value: "20px", easingOut: { type: "linear" } },
        { id: ("kf_w" + (.key|tostring) + "_o1"), frame: (.key * $stagger + $enter), property: "opacity",            value: "1",     easingOut: { type: "cubic-bezier", params: [0.34, 1.56, 0.64, 1] } },
        { id: ("kf_w" + (.key|tostring) + "_t1"), frame: (.key * $stagger + $enter), property: "transform.translateY", value: "0px",  easingOut: { type: "cubic-bezier", params: [0.34, 1.56, 0.64, 1] } }
      ]
    }
  )
'
```

Output: array de N layers listos para meter en `scene.layers`.

> Nota visual: como cada layer ocupa todo el frame y tiene su propia `<div class="hero-row">` posicionando el texto centrado, las N palabras se superponen visualmente. Para alinearlas en fila, lo correcto es:
>
> 1. Calcular el ancho de cada palabra (estimación: ancho_px ≈ caracteres × tamaño_fuente × 0.55 para sans medium 600).
> 2. Posicionar cada `.word` con `position: absolute; left: <x>px;` calculado offline antes de generar.
>
> Para una primera iteración rápida, usa **un solo layer con TODA la frase** (sin stagger palabra-a-palabra) y asume el compromiso documentado en sección 2.
