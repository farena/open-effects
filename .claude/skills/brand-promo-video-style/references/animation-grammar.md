# Gramática de animaciones — estilo del video analizado

Cómo se mueve cada elemento, cómo se encadenan las escenas y qué timings respetar.

> **Nota sobre la implementación**: Este archivo describe la GRAMÁTICA de movimiento (qué entra cómo, en qué orden, con qué cadencia). En el demo HTML la gramática se aplica con `@keyframes` y `transition`, pero en el **entregable real (open-effects)** se aplica con el array `keyframes` de cada layer del ProjectJson — un keyframe = `{ frame, property, value, easingOut }`. Las correspondencias entre ambos están en `references/open-effects-components.md`. Las CSS animations/transitions dentro del CSS del layer **no son la primitiva nativa** y no se renderizan deterministamente — anima con `keyframes`.

---

## Principios de movimiento

1. **Spring/elastic, no lineal**. Todo entra con un ligero "rebote" como si tuviera masa.
2. **Stagger generoso**. Los elementos no aparecen a la vez — entran escalonados, separados por 80-120 ms.
3. **Tiempos cortos, transiciones rápidas**. Cada animación dura 400-700 ms. El espectador no debe esperar.
4. **Salidas más rápidas que entradas**. Si la entrada dura 600 ms, la salida dura 300-400 ms.
5. **El cursor de ratón es un personaje**. Se mueve en arcos, no en línea recta. Easing elastic en su llegada.

---

## Easings canónicos

Usar exclusivamente estas curvas. En open-effects se aplican como `easingOut: { type: "cubic-bezier", params: [...] }` o `easingOut: { type: "spring", params: { damping, stiffness, mass } }`; en el demo HTML con `cubic-bezier(...)`:

| Nombre | Cubic-bezier (CSS demo) | En open-effects (`easingOut`) | Cuándo |
|--------|--------------------------|-------------------------------|--------|
| **Spring entrada** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `{ "type": "cubic-bezier", "params": [0.34, 1.56, 0.64, 1] }` o `{ "type": "spring", "params": { "damping": 12, "stiffness": 100, "mass": 0.6 } }` | Cualquier elemento que aparece (texto, icono, píldora, card) |
| **Spring fuerte** | `cubic-bezier(0.68, -0.55, 0.27, 1.55)` | `{ "type": "cubic-bezier", "params": [0.68, -0.55, 0.27, 1.55] }` o `{ "type": "spring", "params": { "damping": 10, "stiffness": 120, "mass": 0.6 } }` | Iconos en círculo/píldora — más overshoot |
| **Salida suave** | `cubic-bezier(0.4, 0, 0.2, 1)` | `{ "type": "cubic-bezier", "params": [0.4, 0, 0.2, 1] }` | Cualquier elemento que se va |
| **Cursor** | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | `{ "type": "cubic-bezier", "params": [0.25, 0.46, 0.45, 0.94] }` | Movimiento del cursor de ratón |
| **Crossfade entre escenas** | `cubic-bezier(0.4, 0, 0.6, 1)` | `{ "type": "cubic-bezier", "params": [0.4, 0, 0.6, 1] }` | Transición fade global (puede ir en `scene.transitionIn.type = "fade"` con `durationFrames`) |

NO usar `{ "type": "ease-in" }`, `{ "type": "ease-out" }`, `{ "type": "ease-in-out" }` por nombre — son demasiado planos para este estilo. Igual con `{ "type": "linear" }`: úsalo solo para keyframes-hold (mantener un valor entre dos frames con el mismo `value`) o drift muy lento de blobs.

---

## Patrones de entrada por tipo de elemento

### Texto hero (frase grande)

- **Animación**: aparición palabra por palabra, cada palabra desde 20 px abajo + opacity 0 → 1.
- **Stagger entre palabras**: 80 ms (≈2 frames @30fps, ≈5 @60fps).
- **Duración por palabra**: 500 ms (15 frames @30fps).
- **Easing**: spring entrada.

En el **demo HTML** (solo para validación visual con cliente):

```css
@keyframes word-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.word {
  animation: word-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.word:nth-child(1) { animation-delay: 0ms; }
.word:nth-child(2) { animation-delay: 80ms; }
.word:nth-child(3) { animation-delay: 160ms; }
/* etc */
```

En **open-effects** (entregable real): un layer por palabra con startFrame `n * 2` y dos pares de keyframes (`opacity 0→1`, `transform.translateY 20px→0px`) en frame `n*2` y `n*2 + 15`, ambos easing-out con `cubic-bezier(0.34, 1.56, 0.64, 1)`. Plantilla completa en `references/open-effects-components.md` sección 2.

### Píldora con icono (feature)

Tres sub-animaciones encadenadas. En open-effects se materializan típicamente con **dos layers**: uno para el círculo+icono (Material Symbols) y otro para el texto. Ver plantilla en `references/open-effects-components.md` sección 3.

1. **Círculo del icono**: scale 0 → 1.1 → 1, opacity 0 → 1. Duración 600 ms (18 frames @30fps), easing spring fuerte.
2. **Icono interior**: como Material Symbols ya forma parte del mismo layer, hereda la animación del círculo. Si necesitas un fade-in independiente del icono interior, sepáralo en un sub-layer adicional con delay 200 ms (6 frames).
3. **Texto de la feature**: aparece 350 ms después del inicio del círculo (≈11 frames), slide desde la izquierda (`transform.translateX -20px → 0px`) + opacity 0 → 1. Duración 500 ms (15 frames).

Total: ~900 ms (27 frames @30fps) desde inicio hasta texto completamente visible.

### UI fake / mockup (cards de email, kanban)

- **Cards individuales**: cada card aparece desde 30 px abajo + opacity, stagger 100 ms entre cards.
- **Líneas de placeholder dentro de cards**: aparecen con stagger 50 ms desde la izquierda, simulando typing.
- **Easing**: spring entrada.

### Notificaciones flotantes (acto 1)

Patrón único, característico del video:

- ~12-16 píldoras de notificación dispersas por la pantalla — **un layer por notificación** en open-effects.
- **Entrada**: cada notificación aparece desde fuera del frame (lateral aleatorio), stagger 60-80 ms (2 frames @30fps) entre ellas via `startFrame` desplazado. La fase entera dura ~1.5 s (45 frames).
- **Estado en pantalla**: rotación aleatoria entre -5° y +5° (hardcodeada en CSS estático del layer; si necesitas animarla, usa `transform.rotate` en keyframes y elimina el `transform: rotate(...)` del CSS).
- **Movimiento idle**: drift muy lento con keyframes ping-pong en `transform.translateY` (`0px → -4px → 0px` en bucles de 90-120 frames).
- **Salida (al iniciar acto 2)**: añade keyframes finales hacia `opacity: 0` y `transform.translateY: -40px` con stagger 30 ms (1 frame). En open-effects, lo más limpio es resolver la salida en la `transitionIn` de la siguiente escena (`{ type: "fade", durationFrames: 12 }`) en lugar de animar manualmente cada notif.

### Cursor de ratón

- **Entrada**: aparece desde fuera del frame (esquina inferior derecha o izquierda) con un movimiento en arco hacia el elemento que va a "señalar". Duración 800 ms.
- **Estado de hover**: pequeño bounce en el destino (3-4 px de oscilación) durante 600 ms.
- **Click implícito**: scale del cursor 1 → 0.85 → 1 en 200 ms en el momento del "clic".
- **Salida**: se desliza fuera del frame, easing salida suave, 400 ms.

---

## Transiciones entre escenas

En open-effects, las transiciones entre escenas se modelan con `scene.transitionIn` (`{ type, durationFrames }`). Tipos disponibles: `none | fade | slide-left | slide-right | slide-up | slide-down`. Para efectos no nativos (zoom-in al lockup, wipe con blob), se simulan con keyframes en los layers de la escena entrante/saliente.

### Tipo 1 — Crossfade con cambio de fondo (más común)

Se usa cuando cambia el fondo (claro ↔ saturado):

- **Salida de la escena anterior**: elementos hacen fade out + scale 1 → 0.95 en 300 ms (9 frames @30fps), añadiendo keyframes finales en cada layer.
- **`transitionIn` de la siguiente escena**: `{ type: "fade", durationFrames: 12 }` (≈400 ms).
- **Entrada de elementos**: 200 ms (6 frames) después del inicio de la escena, los layers individuales empiezan su animación normal.

### Tipo 2 — Wipe con blob (transiciones suaves dentro de fondo claro)

Cuando dos escenas comparten fondo claro:

- El layer del blob persiste pero anima `transform.translateX/Y` y `transform.scale` durante 600 ms (18 frames) con easing salida suave para "moverse" entre escenas. Si el blob es un layer separado por escena, la `transitionIn = { type: "fade", durationFrames: 9 }` basta.
- Los elementos de texto/icono se reemplazan limpiamente — fade out 200 ms (6 frames) en la escena saliente, fade in 300 ms (9 frames) con stagger en la entrante.

### Tipo 3 — Zoom-in al logo (acto 1 → acto 2)

Específica del corte al lockup de marca. No hay tipo nativo, se construye con keyframes:

- Las notificaciones se desvanecen hacia arriba (keyframes finales en sus layers).
- El texto hero (sus N layers de palabras) se contrae al centro (`transform.scale: 1 → 0.4`) mientras hace fade out, 500 ms (15 frames).
- En la siguiente escena (Lockup), el layer del logo aparece desde el centro: `transform.scale: 0.6 → 1.05 → 1`, easing spring fuerte, total 700 ms (21 frames). `transitionIn: { type: "fade", durationFrames: 12 }`.
- Pequeña pausa de ~1 segundo (30 frames) donde solo está el logo.

### Tipo 4 — Push lateral (raro, dentro del acto 3 si hay UI)

Cuando una UI fake "se desliza" para dejar paso a otra. En open-effects: usa `scene.transitionIn = { type: "slide-left", durationFrames: 15 }` en la siguiente escena. La saliente no necesita animación manual de salida — el slide nativo se encarga del crossfade con desplazamiento.

---

## Timings detallados del video analizado (32 segundos)

Para calibrar, este es el desglose temporal aproximado del video original:

| Inicio | Fin | Duración | Escena |
|--------|-----|----------|--------|
| 0:00 | 0:01.5 | 1.5 s | "Si tu [icono email] se te hace pesado" — texto aparece palabra a palabra |
| 0:01.5 | 0:04 | 2.5 s | Notificaciones invadiendo la pantalla, texto sigue visible |
| 0:04 | 0:05 | 1.0 s | Crossfade hacia el blob lavanda + zoom-in del logo (línea minimal del H) |
| 0:05 | 0:07 | 2.0 s | Lockup "[MARCA] \| [Sublabel]" centrado, fondo lavanda con blob |
| 0:07 | 0:09 | 2.0 s | "Deja que tu" — texto fade in |
| 0:09 | 0:11 | 2.0 s | Cambio a fondo violeta + "Redacte respuestas" + cursor |
| 0:11 | 0:13 | 2.0 s | "Organice tus emails" en píldora rectangular, cursor sigue presente |
| 0:13 | 0:15.5 | 2.5 s | Cards "Urgente / Trabajo / Personal" deslizan en horizontal |
| 0:15.5 | 0:18 | 2.5 s | "Resuma conversaciones" — emails fake flotando con rotación |
| 0:18 | 0:20.5 | 2.5 s | Crossfade a fondo claro + píldora "Dominio gratis" + lista .pro/.com/.io |
| 0:20.5 | 0:23 | 2.5 s | "Cifrado y filtros" + animación de símbolos cifrados |
| 0:23 | 0:25.5 | 2.5 s | "48 GB por buzón" píldora |
| 0:25.5 | 0:28 | 2.5 s | "Inspira confianza con cada" — palabra "confianza" en violeta destacado |
| 0:28 | 0:30 | 2.0 s | Mockup de email con texto siendo escrito en gradiente rosa→azul (efecto IA) |
| 0:30 | 0:32 | 2.0 s | Lockup final "[MARCA] \| [Sublabel]" sobre fondo saturado |

**Total escenas: ~14**, duración media 2.3 s. **No bajes de 1.5 s ni subas de 3 s** por escena salvo el lockup final que puede llegar a 2.5-3 s.

---

## Audio (notas para guía de sonido)

Aunque este skill no genera audio, especifica al usuario:

- **Música**: corporate-tech ambient, BPM 90-110, en clave menor (Am, Em). Ejemplos de referencia tipo: "Floating", "Dreams" del catálogo de Epidemic Sound o Artlist categoría "Inspiring tech".
- **Whoosh / sweetener**: sonido suave en cada transición de escena (no un swoosh clásico de TV — algo más sutil tipo "soft riser").
- **Click sutil** cuando el cursor "hace clic".
- **Ducking del voiceover**: en open-effects, en la `audioTrack` de la música, anima `volumeKeyframes` para bajar a `~0.3` durante el voiceover y subir a `~0.9` en silencios narrativos (acto 2 y final del 5). El voiceover va en su propia `audioTrack` sin ducking.

---

## Checklist de revisión de animación

Antes de dar la animación por buena:

- [ ] ¿Cada escena dura entre 1.5 s y 3 s?
- [ ] ¿Hay stagger en los elementos múltiples (palabras, cards, notificaciones)?
- [ ] ¿Los easings son spring/elastic, no lineales ni "ease" simples?
- [ ] ¿Hay un momento de respiro en el acto 2 (lockup) sin texto encima?
- [ ] ¿Aparece el cursor en al menos 2-3 escenas?
- [ ] ¿Las transiciones entre fondos lavanda↔violeta usan crossfade real, no cortes secos?
- [ ] ¿Las notificaciones del acto 1 tienen rotación aleatoria y desaparecen antes del lockup?
- [ ] ¿La palabra clave del acto 5 ("confianza" o equivalente) cambia de color al violeta saturado?
