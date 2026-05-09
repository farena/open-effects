# Tokens de marca — cómo extraer y aplicar los estilos del proyecto

Este archivo es la **regla 1** del skill: el video lleva la cara de la marca del cliente, no la del video analizado. Aquí está el proceso para convertir el brand input del cliente en una paleta y tipografía aplicables al video.

---

## Inputs que necesitas del cliente

| Input | Forma esperada | Si falta… |
|-------|----------------|-----------|
| Color primario | HEX (`#10B981`) o nombre | **Pregunta antes de seguir.** Es lo más crítico. |
| Color(es) secundario(s) | HEX(s) | Opcional. Si falta, derivamos uno. |
| Tipografía | Nombre de fuente | Default: Inter |
| Logo | SVG (preferido) o PNG transparente | Si falta SVG: pide al menos un PNG con buena resolución. Si solo es texto: usa wordmark renderizado en la fuente de marca. |
| Brand guidelines / web | URL opcional | Si la aporta, fetch para extraer paleta y tipografía exactas |

Si el cliente solo dice "queremos algo moderno tipo Linear" sin aportar HEX: pídele al menos un color principal antes de avanzar. **No improvises colores**.

---

## Cómo derivar la paleta completa del video desde el primario

Dado el HEX primario de la marca, deriva los 5 roles cromáticos del sistema:

### 1. Primario saturado (fondos de actos 3/5, iconos en píldora)

→ Es el HEX que aporta el cliente, sin modificar.

Si el HEX está fuera del rango ideal (saturación demasiado baja o luminosidad muy alta/baja), avísale al cliente: "Tu primario `#XXXXXX` tiene baja saturación; en pantalla saldrá apagado. ¿Te parece si lo subimos a `#YYYYYY` solo para el video?". No lo cambies sin preguntar.

**Rango ideal**: HSL `S: 60-100%`, `L: 45-70%`.

### 2. Fondo claro (60% de las escenas)

→ Mismo H que el primario, llevado a `S: 25-40%`, `L: 94-97%`.

Ejemplos:
- Primario `#6B5CFF` (violeta del video analizado) → fondo claro `#EEEDFB`
- Primario `#10B981` (verde esmeralda) → fondo claro `#E8FAEC`
- Primario `#FF5733` (naranja coral) → fondo claro `#FCEEEA`
- Primario `#0066CC` (azul corporativo) → fondo claro `#E8F0FA`

Fórmula JS para automatizar:
```js
function deriveLightBg(hex) {
  const { h } = hexToHSL(hex);
  return hslToHex(h, 30, 96);
}
```

### 3. Texto oscuro (sobre fondo claro)

→ NO uses negro puro `#000000`. Usa un negro tintado hacia el primario:
HSL del primario, `S: 20-30%`, `L: 12-16%`.

Ejemplos:
- Primario violeta → texto `#1A1A2E`
- Primario verde → texto `#0A1F14`
- Primario naranja → texto `#2E1810`
- Primario azul → texto `#0E1729`

### 4. Acento del acto 1 (icono del problema)

Su rol funcional: **contrastar fuertemente con el primario** para llamar la atención sobre el elemento del problema.

Reglas:

| Si el primario es… | Acento sugerido |
|--------------------|-----------------|
| Frío (azul, violeta, índigo) | Amarillo cálido `#FFC93C` o naranja `#FF8C42` |
| Verde | Amarillo cálido `#FFC93C` o coral `#FF6B6B` |
| Cálido (naranja, rojo, amarillo) | Cian `#22D3EE` o azul claro `#7BB6FF` |
| Magenta/rosa | Amarillo cálido `#FFC93C` o lima `#A3E635` |
| Negro/gris | El acento que la marca use en su diseño; si ninguno: amarillo `#FFC93C` |

Si el cliente tiene un secundario propio que cumple la función contrastante: **úsalo en lugar del derivado**. Esto refuerza la coherencia con la marca.

### 5. Color de "destacado de palabra" en el acto 5

Cuando una palabra clave del CTA cambia de color (como "confianza" en el video analizado), **usa el primario saturado de la marca**, no el acento. El primario y el texto oscuro deben tener suficiente contraste entre sí (ratio ≥ 4.5:1 sobre fondo claro). Si no lo tienen, oscurece el primario un 15-20% en luminosidad solo para esa palabra.

---

## Tabla de tokens — formato estándar de salida

Cuando entregues el bloque "Tokens de marca aplicados" al cliente, usa este formato exacto:

```markdown
## Tokens de marca aplicados al video

| Rol | HEX | Uso |
|-----|-----|-----|
| Primario saturado | #__________ | Fondo de los actos 3 (parte) y 5; iconos en píldora |
| Fondo claro | #__________ | Fondo de los actos 1, 2, 4 y partes del 3 |
| Texto oscuro | #__________ | Sobre fondo claro |
| Texto claro | #FFFFFF | Sobre fondo saturado |
| Acento (acto 1) | #__________ | Icono del problema, único momento del video |
| Highlight palabra | #__________ | Palabra destacada del CTA (acto 5) |

**Tipografía**: __________ (peso 500 para features, 600 para hero/CTA).
**Logo**: provisto por el cliente, formato __________.
```

Confirma con el cliente esta tabla **antes** de escribir guion+storyboard. Es la primera línea de defensa contra revisiones tardías.

---

## Tipografía: cómo decidir

### Caso 1 — La marca tiene fuente propia y es sans-serif geométrica/humanista

Ejemplos: Inter, Geist, Manrope, DM Sans, Plus Jakarta Sans, Söhne, GT Walsheim, Aeonik, Gilroy, Poppins, Outfit.

→ **Úsala directamente**. Si está en Google Fonts, en open-effects la cargas con un `@import url('https://fonts.googleapis.com/css2?family=...')` como **primera regla** del CSS de cada layer que la use (el scoper respeta los at-rules). Si es local, súbela como asset (`POST /api/assets`, `.woff2`/`.woff`/`.ttf`) y refer­éncialala con `@font-face { src: url('<assetPath>'); }`.

### Caso 2 — La marca tiene fuente propia pero es serif, slab, mono o display

Ejemplos problemáticos: Playfair, Merriweather, Lora (serifs), Roboto Mono (mono), Bungee, Lobster, Pacifico (display).

→ **No la uses para el cuerpo del video**. Hace que el motion-graphics del video analizado no funcione (ese estilo necesita sans-serif limpia). Opciones:

1. Recomendar al cliente usar una sans-serif neutra (Inter) y reservar la fuente de marca solo para el lockup del logo.
2. Si el cliente insiste, escala el motion (más calmado, sin animación palabra-a-palabra agresiva, transiciones más suaves) para acomodar la fuente.

Documenta la decisión en el bloque de tokens.

### Caso 3 — La marca no tiene fuente definida

→ Usa **Inter** como default. Anota: "El cliente no ha definido tipografía, usamos Inter como fuente neutra premium."

### Pesos a utilizar

Independientemente de la fuente:
- **600 (semibold)**: texto hero, CTA final.
- **500 (medium)**: texto de feature, stats.
- **400 (regular)**: texto secundario, UI fake (notificaciones, mockups).

Si la fuente no tiene peso 500, usa 400 para esos elementos.

---

## Logo: tratamiento

### Tamaño
- Esquina superior izquierda en TODAS las escenas excepto:
  - Acto 2 (lockup central de marca).
  - Acto 5 final (lockup central final, opcional).
- Tamaño: ~140 px de ancho a 1920×1080. Margen 48 px desde top y left.

### Color
- Sobre fondo claro: logo en color oscuro de la marca (texto oscuro derivado o negro puro si la marca lo usa así en su brand guideline).
- Sobre fondo saturado: logo en blanco (`#FFFFFF`).

Asegúrate de tener **dos versiones** del logo (oscuro y claro). Si solo te dan una, anótalo en specs y propón al cliente generar la otra.

### Formato técnico
- **SVG es lo ideal** porque escala sin pérdida y se renderiza nítido en open-effects, sea como `<img src="<assetPath>">` o como SVG inline en el HTML del layer.
- PNG transparente solo aceptable si está a 4× la resolución final mínima (ej. para canvas 1920×1080, PNG de 560×—px o más).
- Si el repo ya tiene un `BusinessContext` con `lightLogoAssetPath`/`darkLogoAssetPath`, úsalos directamente — no requiere re-upload.

---

## Verificación de contraste y accesibilidad

Antes de cerrar la paleta:

- **Texto oscuro sobre fondo claro**: ratio ≥ 4.5:1 (objetivo WCAG AA texto normal). Si no se llega: oscurece más el texto.
- **Texto blanco sobre primario saturado**: ratio ≥ 4.5:1. Si el primario es muy claro (ej. amarillo, lima), el blanco no funciona — usa el texto oscuro de la marca en su lugar.
- **Acento del acto 1 sobre fondo claro**: el acento tiene que VER, no necesita ratio AAA, pero sí debe destacar visualmente — ratio ≥ 3:1 con el fondo es suficiente.

Herramienta mental rápida: si dudas, oscurece. El estilo del video analizado es alto-contraste sin ser estridente.

---

## Caso especial: marca con paleta multicolor (más de 1 primario)

Algunas marcas (Notion, Slack, Stripe en su versión más reciente) tienen 2-3 colores primarios coexistiendo.

**No los uses todos en el video**. Elige uno como saturado dominante y deja los otros para acentos puntuales (típicamente: una palabra destacada, una píldora específica, un detalle de UI fake). El video analizado es esencialmente bicolor + un acento — esa simplicidad es parte del estilo.

Ejemplo concreto: una marca con primarios `#FF4757` (rojo) y `#5352ED` (violeta) → elige uno como primario del video (preferiblemente el más saturado o el que el cliente identifique como principal), el otro lo dejas como acento del acto 1 o como highlight de palabra.

---

## Checklist antes de pasar al guion

- [ ] Tengo el HEX primario del cliente confirmado.
- [ ] He derivado los 5 roles cromáticos y los he documentado en la tabla.
- [ ] He decidido la tipografía (de marca o fallback Inter) y anotado por qué.
- [ ] Tengo el logo en al menos un formato y dos colores (oscuro y claro).
- [ ] He verificado que los contrastes texto/fondo cumplen ≥ 4.5:1.
- [ ] Si la marca tiene multipaleta, he elegido un solo primario dominante.
- [ ] He compartido la tabla de tokens con el cliente y tengo su OK (o he asumido el riesgo de no preguntar y lo documenté).

Solo entonces pasa a `script-formula.md`.
