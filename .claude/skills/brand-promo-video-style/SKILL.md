---
name: brand-promo-video-style
description: Crea videos promocionales animados de 30 segundos para SaaS/productos digitales en el estilo motion-graphics del video analizado (kinetic typography minimalista, iconos en píldoras, transiciones spring, narración problema→solución→features→CTA), pero APLICANDO SIEMPRE LOS ESTILOS DE LA MARCA DEL PROYECTO — paleta, tipografía y logo del cliente, no los del video analizado. Producción técnica final OBLIGATORIAMENTE con la API de open-effects (PATCH ProjectJson sobre escenas + layers HTML/CSS + keyframes), siguiendo el skill `open-effects-video`. Usar este skill SIEMPRE que el usuario pida un video promocional, anuncio animado, motion graphics, video corto para producto/SaaS, video para redes sociales, ad de marca, kinetic typography, video explainer, comercial corto, o crear contenido video con estilo limpio/moderno/profesional para una marca — incluso si no menciona "open-effects" explícitamente. Genera tanto el guion (script + voiceover) como las animaciones (storyboard escena-por-escena con timings, transiciones y un ProjectJson ejecutable contra la API de open-effects).
---

# Brand Promo Video Style (con open-effects)

Skill para producir videos promocionales animados de ~30 segundos. Toma como **referencia narrativa y de motion** el video analizado, pero **aplica siempre los estilos visuales de la marca del proyecto**, e implementa el resultado final con la **API de open-effects** (escenas + layers HTML/CSS + keyframes vía PATCH `/api/projects/:id`).

Tres entregables:

1. **Guion** (script narrativo + voiceover en español o el idioma solicitado).
2. **Storyboard** escena-por-escena con specs visuales adaptadas a la marca.
3. **Implementación open-effects** (ProjectJson con scenes/layers/keyframes, listo para PATCH).

---

## Dos reglas duras de este skill

### Regla 1 — Brand-first, siempre

**El estilo del video analizado define la GRAMÁTICA visual: estructura narrativa, ritmo, tipos de animación, layouts, jerarquía de elementos, easings.**

**Pero los TOKENS visuales — colores, tipografía, iconografía, logo — los dicta SIEMPRE la marca del proyecto.**

Concretamente:

| Aspecto | De dónde viene |
|---------|----------------|
| Estructura de 5 actos | Video analizado |
| Ritmo (~14 escenas, 1.5-3 s c/u) | Video analizado |
| Easings spring/elastic | Video analizado |
| Idea de "fondo claro alternado con fondo saturado" | Video analizado |
| Animación palabra-a-palabra del texto hero | Video analizado |
| Píldora circular para iconos de feature | Video analizado |
| Cursor de ratón como elemento narrativo | Video analizado |
| **Color primario saturado** | **Marca del proyecto** |
| **Color de fondo claro** | **Marca del proyecto** (derivado del primario) |
| **Tipografía** | **Marca del proyecto** |
| **Logo y wordmark** | **Marca del proyecto** |
| **Set de iconos** | **Marca del proyecto** (si tiene) o Material Symbols neutro |
| **Color de acento del acto 1** | **Marca del proyecto** (color secundario que contraste con el primario) |

NUNCA uses los HEX del video analizado (lavanda+violeta `#EEEDFB` / `#6B5CFF`) como colores literales del entregable. Esos HEX aparecen en los archivos de referencia SOLO como ejemplos pedagógicos de calibración — siempre los sustituyes por los tokens de la marca del proyecto.

Si el usuario no aporta los tokens de marca, **pregúntalos en el briefing** antes de continuar. En este repo, los tokens también pueden venir del `BusinessContext` del proyecto (logos light/dark, color primario/secundario, nombre); revísalo antes de preguntar.

### Regla 2 — Producción técnica con la API de open-effects

Cuando el entregable incluya animaciones reales (no solo guion+storyboard en texto), **úsa open-effects**. No HTML+CSS+JS plano servido en el navegador, no After Effects, no Lottie a pelo, no Remotion directo. La API de open-effects.

**Antes de construir el ProjectJson**, carga el skill `open-effects-video` (canónico para la API) siguiendo las instrucciones de `references/open-effects-integration.md`. Ese archivo te dice exactamente cómo combinar las dos disciplinas (estilo del video analizado × producción open-effects) y cómo invocar la API.

Las plantillas de layers + keyframes adaptadas a este estilo están en `references/open-effects-components.md`.

El demo HTML+CSS de `assets/demo-reference.html` se conserva SOLO como referencia visual rápida para enseñarle al cliente cómo se ve el estilo antes de comprometerse con la producción en open-effects. **No es un entregable final**.

---

## Cuándo usar este skill

Activarlo en cuanto el usuario pida cualquier cosa parecida a:

- "Crea un video promocional para [marca]"
- "Necesito un anuncio animado de 30 segundos"
- "Haz un motion graphics para mi producto"
- "Video estilo Linear / Notion / SaaS moderno"
- "Guion + animación para un comercial"
- "Video explainer de mi app"
- "Kinetic typography para [producto]"
- "Anuncio para Instagram/YouTube/TikTok de mi marca"
- "Video con open-effects" (si además menciona estilo limpio/moderno)

Si el usuario solo aporta el nombre de la marca y poco más, **interrogar primero** (ver "Briefing inicial").

---

## Workflow de alto nivel

```
1. Briefing  →  2. Tokens de marca  →  3. Guion  →  4. Storyboard  →  5. Producción open-effects  →  6. Entrega
```

Cada fase tiene su archivo de referencia. Lee `references/` cuando entres en cada fase, no todo de golpe.

| Fase | Archivo de referencia | Cuándo leerlo |
|------|----------------------|---------------|
| Briefing | (esta SKILL.md) | Siempre, primero |
| Tokens de marca | `references/brand-tokens.md` | Tras el briefing, antes del guion |
| Guion | `references/script-formula.md` | Cuando vayas a escribir el guion |
| Storyboard | `references/storyboard-template.md` | Al diseñar escena por escena |
| Gramática visual | `references/visual-system.md` | Para entender la GRAMÁTICA (proporciones, layouts, sombras), aplicada con tokens de marca |
| Gramática de motion | `references/animation-grammar.md` | Para definir transiciones, timings, easings |
| **Integración open-effects** | **`references/open-effects-integration.md`** | **OBLIGATORIO antes de construir el ProjectJson** |
| **Componentes open-effects** | **`references/open-effects-components.md`** | **Plantillas reutilizables de layers + keyframes** |
| HTML/CSS (uso restringido) | `references/svg-html-templates.md` | Solo para demos rápidos en navegador o bloques embebibles en web. NO es el formato de producción del video — la producción es ProjectJson de open-effects. |
| Ejemplo calibración | `references/example-output.md` | Lectura única, antes de redactar el primer entregable |
| Demo visual rápido | `assets/demo-reference.html` | Solo para enseñar el estilo al cliente; NO como entregable final |

---

## Briefing inicial (obligatorio antes de escribir nada)

No empieces a escribir guion hasta tener estos **8 datos**. Si el usuario no los aporta, **pregúntalos al inicio**, agrupados.

### Datos del producto (5)

1. **Marca y producto** — Nombre, qué hace en una frase.
2. **Problema que resuelve** — La fricción/dolor del usuario actual.
3. **3-5 features clave** — Funciones que merecen aparecer en pantalla con icono.
4. **CTA / acción final** — "Pruébalo gratis", "Pásate a X", "Descarga", etc.
5. **Idioma y duración** — Default: español, 30 s.

### Tokens de marca (3) — críticos para la regla 1

6. **Color(es) primario(s) de la marca** — HEX. Si solo aporta uno, derivamos el resto.
7. **Tipografía de la marca** — Nombre de la fuente. Si no tiene, usaremos Inter como default neutral.
8. **Logo** — Idealmente SVG o PNG con buena resolución. En este repo se sube como asset vía `POST /api/assets` y luego se referencia en un layer con `<img src="...">`.

Si el usuario es lacónico ("hazme un video para Acme, una app de notas"), haz **una sola pregunta consolidada** en prosa breve, agrupando las lagunas más críticas. No alargues el briefing más de un turno. Si existe un `BusinessContext` (tabla del proyecto open-effects) con logo y colores, úsalos como default y confirma con el usuario.

Detalle de cómo procesar y derivar tokens → `references/brand-tokens.md`.

---

## Estructura narrativa — tres plantillas según el producto

El skill soporta **tres plantillas de guion** calibradas sobre un corpus de 3 spots reales (mismo cliente, distintos productos). Elige UNA según el tipo de producto:

| Plantilla | Duración | Cuándo usarla | Hook característico |
|-----------|----------|---------------|---------------------|
| **A — Aspiracional / Tutorial** | 40–43 s | Productos creadores/transformadores (builders, IA generativa, no-code) | "¿Tienes [aspiración]? Ahora puedes hacerla realidad con [marca]." |
| **B — Dolor / Pain-led** | 28–32 s | Productos que reemplazan algo doloroso (productividad, gestión, reemplazo de manual) | "Si tu [objeto] se te hace [adjetivo de fricción], pásate a [marca]." |
| **C — Promesa directa / Spec-led** | 36–42 s | Infraestructura, dev tools, hardware-near, productos técnicos con specs y prueba social | "Obtén [valor cuantificable] con [producto] de [marca]." |

**Defaults orientativos por plantilla** (detalle completo en `references/script-formula.md`):

| Plantilla | Bloques | Pausa silente acto 2 | Densidad voz |
|-----------|---------|----------------------|--------------|
| A | Hook → 3 pasos del flujo → feature extra → barrera-eliminada + síntesis → CTA + tagline | No | ~2.6 wps |
| B | Hook de dolor → (opcional silencio) → regla de 3 con "Deja que…" → stats con cifras → cierre emocional o CTA | Opcional (omitir si ≤30 s) | ~2.2 wps |
| C | Hook promesa → 4–6 features paralelas "Con X, Y" → prueba social → CTA URL completo | No | ~2.6 wps |

**Ritmo visual**: cada escena dura entre 1.5 s y 3 s en cualquier plantilla. El ritmo de voiceover varía por plantilla (tabla anterior).

**Importante**: la "transición de marca silente" en el segundo 4–7 que aparecía en versiones anteriores de este skill **NO es obligatoria**; ninguno de los 3 spots de referencia la usa. Es un recurso opcional, válido solo en B cuando hay margen (>30 s).

Detalle completo de las plantillas, plantillas rellenables y recursos lingüísticos transversales → `references/script-formula.md`.

---

## Sistema visual — los 7 elementos no negociables (gramática)

Estos 7 son DECISIONES DE FORMA, no de color. Aplícalos siempre, con los tokens de la marca:

1. **Dos fondos alternados**: uno claro (derivado de la marca, S~30% L~96%) con un blob orgánico saturado apenas visible, y otro saturado (primario de la marca) plano. En open-effects se aplican con el campo `scene.background` (HEX o gradiente CSS), y el blob se monta como un layer SVG dedicado.
2. **Tipografía**: la de la marca si es sans-serif geométrica/humanista. Si es serif o decorativa, fallback a Inter. Peso medium/semibold, tracking ligeramente ajustado, tamaño grande (~64-80 px sobre canvas 1920×1080). En open-effects se carga con `@import url('https://fonts.googleapis.com/...')` como **primera regla** del CSS del layer (el scoper respeta los at-rules); para fuentes de marca propias, súbelas como asset y referencia con `@font-face`.
3. **Iconos en píldora circular**: cada feature lleva un icono blanco dentro de un círculo del primario sólido (~80-120 px Ø) con sombra blanda. **Iconos preferentemente con Material Symbols** (ver `open-effects-video` skill, sección "Material Symbols") — animan limpiamente y no requieren upload de asset.
4. **Color de acento del acto 1**: secundario contrastante con el primario de la marca (típicamente amarillo cálido si el primario es frío; o coral si el primario es verde/azul). Aparece SOLO en el acto 1.
5. **Sombras suaves y largas**, nunca duras. Difuminado generoso, opacidad baja (10-15 %). Definidas inline en el CSS del layer.
6. **Cursor de ratón animado** como elemento narrativo recurrente — color contrastante con el fondo donde aparece. En open-effects es un layer SVG con keyframes en `transform.translateX` / `transform.translateY` / `opacity`.
7. **Movimiento spring/elastic, nunca lineal**. Easings concretos en `references/animation-grammar.md`. En open-effects: cada keyframe lleva un `easingOut` que es `{ type: "cubic-bezier", params: [...] }` o `{ type: "spring", params: { damping, stiffness, mass } }`. Las animaciones CSS (`@keyframes`/`transition`) NO son la primitiva nativa — se anima con el array `keyframes` del layer.

Specs detalladas (proporciones, escalas tipográficas, layouts canónicos) → `references/visual-system.md`.

---

## Safe zones de Instagram (obligatorio para Reels y Stories)

Cuando el video se entregue para **Instagram Reels** o **Instagram Stories**, todo el contenido crítico (texto, logo, CTA, iconos de feature, números/stats) debe vivir DENTRO del safe area definido por Instagram. La UI nativa de la app (status bar arriba, nombre de usuario y botón "follow", caption, audio, botones like/comment/share/save/menú a la derecha, barra de progreso) tapa los bordes del frame y oculta cualquier elemento que pongas ahí.

### Dimensiones canónicas

| Formato | Aspect ratio | Frame total | Crop visible en feed/grid | Safe area (contenido crítico) |
|---------|--------------|-------------|---------------------------|-------------------------------|
| **Reels** | 9:16 | **1080 × 1920 px** | 1080 × 1440 px (3:4 en grid del perfil) | área central recortada por la UI (ver márgenes abajo) |
| **Stories** | 9:16 | **1080 × 1920 px** | — | **1080 × 1610 px** (centrado vertical) |
| **Posts** (feed) | 4:5 | 1080 × 1350 px | 1012 × 1350 px (3:4 en grid) | Mantener texto fuera de las esquinas |

### Márgenes seguros para Reels (canvas 1080 × 1920)

| Borde | Píxeles a reservar | Qué tapa la UI ahí |
|-------|--------------------|--------------------|
| **Superior** | ~250 px | Status bar del sistema + nombre de usuario + botón "Seguir" |
| **Inferior** | ~340 px | Caption, audio, botones de sticker/efecto, barra de progreso |
| **Derecho** | ~220 px | Iconos like / comentar / compartir / guardar / menú "..." |
| **Izquierdo** | ~60 px | Margen mínimo (sangrado) |

→ **Safe area útil para Reels: aproximadamente 800 × 1330 px**, desplazada ligeramente hacia el centro-arriba del canvas.

### Reglas de aplicación

1. **El frame total siempre rellena el canvas completo** (fondos, blobs, gradientes, decoraciones pueden y DEBEN llegar a los bordes 1080×1920). Nada de letterbox.
2. **El contenido crítico NUNCA toca los márgenes** definidos arriba. Logo, hero text, iconos en píldora, números de stats, CTA y wordmark final viven dentro del safe area.
3. **Para Reels que también se publican como post (grid view)**, vigila además que los elementos clave de las primeras escenas queden dentro del crop **1080 × 1440** centrado verticalmente — porque eso es lo que se ve como thumbnail en el perfil.
4. **El crop del grid view es distinto del safe area de visualización**. Son dos checks independientes: uno para cuando alguien abre el Reel (safe area), otro para cuando ve el perfil (grid crop).
5. **En open-effects**, aplica los márgenes en el CSS de cada layer crítico (p. ej. `padding-top: 250px; padding-bottom: 340px; padding-right: 220px; padding-left: 60px;` en el contenedor que envuelve el contenido, o usa `top`/`left` absolutos coherentes con esos valores). Documéntalos como constantes en el ProjectJson o en la nota de specs técnicas.
6. **Para Stories** (1080 × 1920) el safe area es más generoso: **1080 × 1610 px centrado** — equivale a ~155 px de margen arriba y abajo. Misma regla: contenido crítico dentro, decoración a sangre.

### Defaults por plataforma de destino

| Plataforma | Composición open-effects | Notas |
|------------|----------------------|-------|
| Instagram Reels / TikTok / YouTube Shorts | 1080 × 1920 @ 30fps | Aplicar safe zones de Reels (más estrictas que Stories) |
| Instagram Stories | 1080 × 1920 @ 30fps | Safe area 1080 × 1610 |
| Instagram Feed (post) | 1080 × 1350 @ 30fps | 4:5 vertical, no usar 1:1 salvo petición explícita |
| YouTube / web horizontal | 1920 × 1080 @ 30fps | Sin safe zones de UI; respetar margen estético del 5 % |

`fps` válidos en open-effects: `24 | 30 | 60`. `width`/`height` enteros entre 1 y 7680. `durationFrames` por escena ≥ 1.

Si el usuario no especifica plataforma de destino, **pregúntalo en el briefing** — afecta directamente al layout de cada escena, no es un detalle cosmético que se decida al final.

---

## Formato del entregable

Cuando termines, presenta al usuario **estos bloques** en este orden:

### 1. Tokens de marca aplicados
Tabla corta mostrando exactamente qué HEX/fuente se usará en el video, derivados del input del cliente. Esto evita malentendidos antes de invertir tiempo en el guion.

### 2. Guion completo
Texto del voiceover en formato:
```
[0:00 – 0:04] (tono: ligeramente exasperado)
"Si tu email se te hace pesado..."

[0:04 – 0:07] (pausa, transición)
[Sin narración — lockup de marca]

[0:07 – 0:11] (tono: confiado, claro)
"Deja que tu asistente con IA redacte respuestas..."
```

### 3. Storyboard escena por escena
Tabla o lista numerada con: timestamp · acción visual · texto en pantalla · narración · transición de salida (mapeada al `transitionIn` de la siguiente escena en open-effects). Plantilla en `references/storyboard-template.md`.

### 4. Specs técnicas
Lista corta con: paleta exacta (los HEX de la marca, no del video analizado), tipografía elegida, dimensiones según plataforma de destino, fps, formato de export y — cuando aplique — **safe zones**. Anotar también cualquier asset que requiera upload previo (`POST /api/assets`): logo, audio del voiceover/música, mockups de producto.

- **Instagram Reels / TikTok / Shorts**: 1080 × 1920 @ 30fps, safe area útil ~800 × 1330 px (márgenes 250 top / 340 bottom / 220 right / 60 left). Vigilar también el crop 1080 × 1440 para grid del perfil.
- **Instagram Stories**: 1080 × 1920 @ 30fps, safe area 1080 × 1610 (155 px arriba y abajo).
- **Instagram Feed**: 1080 × 1350 @ 30fps (4:5).
- **YouTube / web horizontal**: 1920 × 1080 @ 30fps, sin safe zones de UI (margen estético 5 %).

Detalle completo y reglas de aplicación → sección "Safe zones de Instagram" arriba.

### 5. Implementación open-effects (cuando el usuario quiera código)
ProjectJson estructurado: `id`, `name`, `width`, `height`, `fps`, y un array `scenes[]` con sus `layers[]` y `keyframes[]`. Conversión ms→frames hecha contra el `fps` elegido (a 30fps: 1s = 30 frames; 80ms ≈ 2-3 frames; 600ms ≈ 18 frames). Detalle completo en `references/open-effects-integration.md` y `references/open-effects-components.md`.

No intentes implementar las 14 escenas en una sola pasada — empieza por las escenas 1, 2 y 3 (hook, lockup, primera feature), haz un PATCH al proyecto y previsualiza en el editor antes de continuar. Esto sigue el patrón "iterative PATCH" recomendado por el skill `open-effects-video`.

---

## Anti-patrones — qué NO hacer

- ❌ **No uses los HEX del video analizado** (`#EEEDFB`, `#6B5CFF`) en el entregable. Son ejemplos pedagógicos.
- ❌ **No uses CSS `@keyframes` ni `transition` como primitiva de animación en los layers de open-effects**. La animación canónica es el array `keyframes` del layer (un keyframe = `{ frame, property, value, easingOut }`). Las CSS animations dentro del layer no son deterministas en render. Sí está bien usar `@import` para fuentes y mantener CSS estático para layout.
- ❌ **No uses emojis** dentro de las animaciones. Iconos con Material Symbols o SVG inline.
- ❌ **No metas más de 6 features.** Si el usuario lista 10, propón consolidar.
- ❌ **No uses fondo blanco puro** (`#FFFFFF`). Siempre el tinte derivado del primario de la marca en `scene.background`.
- ❌ **No uses gradientes multicolor estilo Stripe/Linear** en los fondos principales. Bicolor + un acento.
- ❌ **No uses serif ni display fonts decorativas** salvo que la marca lo exija fuertemente.
- ❌ **No excedas la densidad de palabras de tu plantilla**. B: ≤75 palabras / 30 s (2.0–2.3 wps). A y C: ≤115 palabras / 40–43 s (2.5–2.7 wps). Pasarse satura al espectador y rompe el ritmo visual.
- ❌ **No mezcles plantillas**. Elige A, B o C en el briefing y mantenla todo el guion. Hook de dolor + cuerpo aspiracional + prueba social técnica suena schizofrénico.
- ❌ **No incluyas prueba social falsa o inflada** ("recomendado por expertos" sin fuente, "millones de usuarios" sin cifra). Si no tienes prueba social real, usa la plantilla B en lugar de C.
- ❌ **No metas la "transición silente" del acto 2 por defecto**. Es opcional, solo válida en B cuando hay margen (>30 s). Ninguno de los 3 spots del corpus de referencia la usa.
- ❌ **No describas el video en prosa larga.** Entrega los bloques estructurados.
- ❌ **No saltes el briefing.** Si faltan los 8 datos, pregúntalos antes de escribir.
- ❌ **No produzcas video sin el skill `open-effects-video` cargado** si vas a generar ProjectJson. Lee `references/open-effects-integration.md` primero.
- ❌ **No uses propiedades animables que open-effects no soporta**. Las soportadas son: `opacity`, `transform.translateX`, `transform.translateY`, `transform.scale`, `transform.rotate`, `color`, `background-color`, `border-radius`, `width`, `height`, `top`, `left`. Para todo lo demás (filter, blur dinámico, clip-path animado, etc.) usa varios layers o cambios de estado entre escenas.
- ❌ **No coloques contenido crítico (logo, hero text, CTA, números, iconos en píldora) en los bordes del canvas 1080×1920** cuando el destino sea Instagram Reels o Stories. La UI de Instagram tapa ~250 px arriba, ~340 px abajo y ~220 px a la derecha en Reels (155 px arriba/abajo en Stories). Respetar siempre la sección "Safe zones de Instagram".
- ❌ **No asumas plataforma de destino**. Si el usuario no la indicó, pregúntala antes del storyboard — un Reel y un video de YouTube tienen layouts incompatibles.
- ❌ **No dispares un render (`POST /api/render/:id`) sin que el usuario lo pida explícitamente**. El skill `open-effects-video` deja claro que el render es opcional y on-demand.

---

## Recordatorio final

Antes de escribir guion: lee `references/brand-tokens.md` (para fijar los colores/tipo del proyecto) y `references/script-formula.md`.

Antes de escribir storyboard: lee `references/visual-system.md` y `references/animation-grammar.md`.

Antes de escribir el ProjectJson: lee `references/open-effects-integration.md` (que te dice cómo invocar el skill `open-effects-video`) y `references/open-effects-components.md`.

El estilo es **minimalista, premium, confiado, sin estridencias** — pero siempre con la cara de la marca del proyecto, no del video analizado. Cuando dudes entre añadir un elemento o quitarlo: quítalo.
