# Sistema visual — gramática del estilo del video analizado

Especificaciones de proporciones, layouts, sombras, iconografía y composición.

> **Importante**: este archivo describe la GRAMÁTICA del estilo (qué proporción tiene una píldora, dónde va el logo, qué sombra lleva un icono). **Los HEX y la fuente concretos los aporta `references/brand-tokens.md` derivados de la marca del cliente**. Este archivo cita los HEX del video analizado SOLO como ejemplo pedagógico — nunca los uses literalmente en un entregable.

---

## Paleta cromática — sistema de roles

El estilo opera con **5 roles cromáticos**, no con colores fijos. Los HEX se obtienen de `brand-tokens.md`:

| Rol | Origen | Uso |
|-----|--------|-----|
| **Primario saturado** | HEX del cliente | Fondo del 30% de las escenas + iconos en píldora |
| **Fondo claro** | Derivado del primario (H igual, S~30%, L~96%) | Fondo del 60% de las escenas |
| **Texto oscuro** | Derivado del primario (H igual, S~25%, L~14%) | Sobre fondo claro |
| **Texto claro** | `#FFFFFF` | Sobre fondo saturado y dentro de iconos en píldora |
| **Acento del acto 1** | Color contrastante (ver `brand-tokens.md`) | Icono del problema, ÚNICO momento del video |

**Ejemplo de calibración con los tokens del video analizado** (no copiar literal a otros proyectos):

| Rol | HEX del video analizado |
|-----|--------|
| Primario saturado | `#6B5CFF` |
| Fondo claro | `#EEEDFB` |
| Texto oscuro | `#1A1A2E` |
| Texto claro | `#FFFFFF` |
| Acento del acto 1 | `#FFC93C` (amarillo cálido) |

### Acentos secundarios (uso muy puntual, opcionales)

Estos roles son OPCIONALES — solo aparecen si el storyboard los necesita:

| Rol | Origen | Uso típico |
|-----|--------|-----|
| Color de notificación verde | Verde estándar de UI o el secundario de la marca | Badges de "éxito" en el caos del acto 1 |
| Texto degradado IA | Mezcla rosa→azul o el gradiente de la marca si lo tiene | Efecto "IA generando texto" en mockup final |
| Gris UI claro | `#F5F5F8` o gris derivado del texto oscuro | Fondo de elementos de UI fake (líneas placeholder, botones inactivos) |

### Gradiente blob de fondo

Sobre el fondo claro, hay un blob orgánico apenas visible que da profundidad. Especificación:

- Forma: elipse irregular o blob SVG.
- **Color: el primario de la marca** con opacidad 12-18 %.
- Filtro: `blur(80-120px)`.
- Posición: cambia entre escenas (esquina inferior derecha, lateral izquierdo, centro). Aporta variación sutil.

### Cómo derivar HEX para una marca nueva

Está cubierto en `references/brand-tokens.md`. Resumen:

1. **Primario**: HEX del cliente. Si tiene saturación baja (<60%), pídele permiso para subirla en pantalla.
2. **Fondo claro**: mismo H, S~30%, L~96%.
3. **Texto oscuro**: mismo H, S~25%, L~14%.
4. **Acento del acto 1**: color que contraste fuertemente con el primario (frío→cálido y viceversa).

---

## Tipografía

### Fuente principal

**Cómo se elige la fuente**: cubierto en `references/brand-tokens.md` sección "Tipografía: cómo decidir". Resumen:

- **Marca con fuente propia sans-serif geométrica/humanista** → úsala. Ejemplos válidos: Inter, Geist, Manrope, DM Sans, Plus Jakarta Sans, Söhne, GT Walsheim, Aeonik.
- **Marca con fuente serif/display/decorativa** → fallback a Inter, fuente de marca solo en lockup del logo.
- **Sin fuente definida** → Inter como default neutro.

Carga técnica en open-effects: para Google Fonts, pon un `@import url('https://fonts.googleapis.com/css2?family=...')` como **primera regla** del CSS de los layers que usen la fuente — el scoper del runtime respeta los at-rules `@import`. Para fuentes locales/premium de marca, súbelas como asset (`POST /api/assets`, archivos `.woff2`/`.woff`/`.ttf`) y refer­éncialas desde el CSS del layer con `@font-face { src: url('<assetPath>'); }`.

### Escala (canvas 1920×1080)

| Uso | Tamaño | Peso | Tracking |
|-----|--------|------|----------|
| Texto principal hero (acto 1, 2 líneas) | 96 px | 600 | -1.5% |
| Texto de feature (acto 3) | 72 px | 500 | -1% |
| Texto de stat con icono (acto 4) | 64 px | 500 | -0.5% |
| CTA final (acto 5) | 80 px | 600 | -1% |
| UI fake (notificaciones, emails) | 18-24 px | 400-500 | 0 |
| Texto secundario (logo Mail subline) | 32 px | 400 | 0 |

Para canvas vertical 1080×1920 (Reels/TikTok): reducir todos los tamaños un 15%.
Para canvas cuadrado 1080×1080 (feed Instagram): reducir un 25%.

### Color del texto

- Sobre fondo claro → texto oscuro de la marca (rol "texto oscuro" derivado).
- Sobre fondo saturado → blanco.
- Para palabras destacadas dentro de una frase (ej. "Inspira **confianza**" en el acto 5) → cambia el color al **primario saturado de la marca**, mientras el resto del texto se mantiene en texto oscuro.

### Alineación

- Texto hero (acto 1, 5): centrado horizontalmente, ligeramente por encima del centro vertical (40% desde arriba).
- Feature con icono (acto 3, 4): icono+píldora a la izquierda, texto a la derecha, conjunto centrado horizontalmente, centrado verticalmente.

---

## Iconografía — píldoras circulares

### Especificación del componente

```
[Círculo color primario]   [Texto en color de texto correspondiente al fondo]
   ↳ icono blanco
```

- **Círculo**: diámetro 120 px (canvas 1920×1080), fill = primario saturado de la marca.
- **Sombra del círculo**: blur 32px, offset Y 12px, color = primario de la marca con opacidad 0.25.
  - Ejemplo (video analizado): `0 12px 32px rgba(107, 92, 255, 0.25)`.
  - Ejemplo marca verde `#10B981`: `0 12px 32px rgba(16, 185, 129, 0.25)`.
- **Icono interior**: blanco, stroke 2-2.5px (no relleno sólido), tamaño 50-60% del diámetro del círculo, centrado.
- **Espaciado entre círculo y texto**: 32-40 px.

### Set de iconos

**Si la marca tiene su propio set de iconos consistente** (ej. Notion, Linear, Stripe) → súbelos como assets SVG y refer­éncialos en el HTML del layer. Mantiene la coherencia con su identidad.

**Si no** → usa **Material Symbols** (outlined, rounded o sharp), que están integrados en open-effects vía `@import` de Google Fonts (sección "Material Symbols" del skill `open-effects-video`). Animan limpiamente en `color`, `font-size` y `font-variation-settings`. Como alternativa secundaria: **Lucide** o **Heroicons** SVG inline en el HTML del layer.

Mapeo de conceptos a iconos Material Symbols (referencia para inspiración, sustituir según el dominio del producto del cliente):

| Concepto | Material Symbol (ligature) | Uso típico |
|----------|----------------------------|------------|
| IA / asistente | `auto_awesome` | Features con asistencia inteligente |
| Email | `mail` | Productos relacionados con email |
| Cursor / clic | `arrow_selector_tool` | Elemento narrativo recurrente |
| Carpeta / organización | `folder` | Features de organización |
| Globo / dominio / web | `public` | Productos web/internacional |
| Escudo / seguridad | `verified_user` | Cifrado, seguridad, protección |
| Almacenamiento | `database`, `hard_drive` | Storage, GB, almacenamiento |
| Resumen / lista | `list`, `subject` | Features de resumen, listado |
| Búsqueda | `search` | Búsqueda, exploración |
| Calendario | `calendar_month` | Schedule, fechas |
| Sincronización | `sync` | Sync, integración |
| Notificación | `notifications` | Alertas, recordatorios |
| Tareas | `check_box` | Gestión de tareas |
| Foco | `center_focus_strong` | Modo concentración |
| Velocidad | `bolt` | Performance, rapidez |
| Tiempo | `schedule` | Productividad temporal |

### Cursor de ratón animado

Elemento narrativo del video. Especificación:

- Forma: cursor estándar de OS (puntero negro con borde blanco).
- Tamaño: ~48 px (canvas 1920×1080).
- Color del relleno: **negro o el texto oscuro de la marca**.
- Color del borde: blanco 1.5-2 px.
- Aparece en momentos clave para "señalar" features. Movimiento curvo, easing elastic.
- En el video analizado, el cursor entra desde abajo derecha y se posiciona junto a la píldora del texto en escenas del acto 3.
- En open-effects → un layer SVG inline con keyframes en `transform.translateX/Y` y `opacity`. Plantilla en `references/open-effects-components.md` sección 4.

---

## Layouts canónicos por escena

### Layout A — Hero centrado (actos 1, 2, 5)

```
┌─────────────────────────────────────┐
│  [logo]                             │ ← logo de la marca, esquina sup. izq
│                                     │
│                                     │
│        TEXTO HERO LÍNEA 1           │ ← centrado, 40% desde arriba
│        TEXTO HERO LÍNEA 2           │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Layout B — Feature con icono (actos 3, 4)

```
┌─────────────────────────────────────┐
│  [logo]                             │
│                                     │
│                                     │
│      ⬤   Texto de la feature        │ ← icono+texto centrado horiz.
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Layout C — Caos de notificaciones (acto 1, segunda parte)

```
┌─────────────────────────────────────┐
│  [logo]      [notif]   [notif]      │ ← notificaciones flotando
│      [notif]                        │   en posiciones aleatorias
│                  TEXTO HERO         │   (semi-transparentes,
│        [notif]                      │    rotación leve ±5°)
│                       [notif]       │
│   [notif]    [notif]                │
└─────────────────────────────────────┘
```

### Layout D — UI fake / mockup (acto 3 algunas escenas)

```
┌─────────────────────────────────────┐
│  [logo]                             │
│                                     │
│   ┌──────────┐ ┌──────────┐ ┌──────│ ← múltiples cards de UI
│   │ Urgente  │ │ Trabajo  │ │ Pers │   simulando la app del producto
│   │ ☐ ──────│ │ ☐ ──────│ │ ☐ ──│   con acción visible
│   │ ☐ ──────│ │ ☐ ──────│ │ ☐ ──│
│   └──────────┘ └──────────┘ └──────│
│                                     │
└─────────────────────────────────────┘
```

---

## Sombras y profundidad

Todas las sombras siguen estos parámetros (no usar otras). Los HEX se derivan de los tokens de marca:

- **Sombra suave de píldora/icono**: blur 32px, offset Y 12px, color = primario de la marca con opacidad 0.25.
  - Ejemplo (video analizado): `0 12px 32px rgba(107, 92, 255, 0.25)`.
  - Ejemplo verde `#10B981`: `0 12px 32px rgba(16, 185, 129, 0.25)`.
- **Sombra de tarjeta UI**: blur 24px, offset Y 4px, color = texto oscuro de la marca con opacidad 0.08.
  - Ejemplo (video analizado): `0 4px 24px rgba(26, 26, 46, 0.08)`.
- **Sombra de texto sobre fondo claro**: NUNCA. Solo el texto plano.
- **Glow sobre fondo saturado**: `0 0 60px rgba(255, 255, 255, 0.15)` para destacar elementos importantes (este SÍ es invariante porque opera con blanco puro).

---

## Logo

- Esquina superior izquierda en TODAS las escenas excepto el acto 2 (lockup central) y a veces el acto 5 (lockup central final).
- Tamaño: ~140 px ancho (canvas 1920×1080), márgenes 48 px desde arriba y desde la izquierda.
- En fondo claro: logo en su versión oscura (texto oscuro de la marca o color que el cliente especifique para fondo claro).
- En fondo saturado: logo en blanco.
- Necesitas DOS versiones del logo (oscura y clara). Si el cliente solo aporta una, anótalo en specs y propón generar la otra. En este repo, los logos del proyecto suelen estar en el `BusinessContext` (campos `lightLogoAssetPath` / `darkLogoAssetPath`) — úsalos primero antes de pedir uploads adicionales.
- Acompañado o no de un sublabel ("| Mail", "| Pro", "| Cloud", etc.) en peso regular según corresponda al producto.

---

## Dimensiones recomendadas según destino

| Destino | Resolución | Aspect | Duración objetivo |
|---------|-----------|--------|-------------------|
| YouTube / web | 1920×1080 | 16:9 | 30 s |
| Instagram Reels / TikTok / Shorts | 1080×1920 | 9:16 | 30 s |
| Instagram Feed | 1080×1080 | 1:1 | 30 s o 15 s recortando acto 4 |
| Twitter / X | 1280×720 | 16:9 | 30 s |
| LinkedIn | 1920×1080 | 16:9 | 30 s |

Para 9:16 vertical: reapilar layouts B y C en columnas verticales, mantener tamaños de fuente proporcionales.

---

## Frame rate y export

- **30 fps** mínimo, **60 fps** ideal para movimiento spring. open-effects acepta `fps ∈ {24, 30, 60}`.
- Export: H.264 MP4 vía `POST /api/render/:projectId` (renderizador interno, ver skill `open-effects-video`). El bitrate y AAC audio quedan en defaults razonables; si el cliente necesita un master de máxima calidad, descárgalo y re-encódalo aparte con FFmpeg.
- Para destinos no-MP4 (Lottie, GIF web, etc.) este skill no cubre — recomienda al cliente partir del MP4 y convertir.
