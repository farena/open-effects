# Plantilla de storyboard

Cómo presentar el desglose escena-por-escena al usuario.

---

## Formato preferido — tabla compacta

Para entregables al usuario, usa este formato tabular en markdown:

| # | Tiempo | Layout | Texto en pantalla | Voiceover | Movimiento clave | Transición salida |
|---|--------|--------|-------------------|-----------|-------------------|-------------------|
| 1 | 0:00–0:04 | Hero centrado + caos de notif | "Si tu [📧] se te hace pesado" | "Si tu email se te hace pesado..." | Texto palabra-a-palabra, notif caen con rotación | Notif fade up + zoom-in al logo |
| 2 | 0:04–0:07 | Lockup central | "[MARCA] \| [Sublabel]" | (silencio) | Logo aparece scale spring | Crossfade fondo claro→saturado |
| 3 | 0:07–0:11 | Hero centrado violeta | "Redacte respuestas" | "Deja que tu asistente con IA redacte respuestas..." | Texto palabra-a-palabra + cursor entra arco | Push a siguiente |
| ... | ... | ... | ... | ... | ... | ... |

Mínimo 12 filas, máximo 16, para un video de 30 s.

---

## Formato alternativo — bloques narrativos (para storyboards más largos o cuando el usuario quiere más detalle por escena)

```
══════════════════════════════════════
ESCENA 03  ·  0:07 – 0:11  ·  4 segundos
══════════════════════════════════════

LAYOUT
  Fondo violeta saturado #6B5CFF.
  Texto hero centrado.
  Cursor de ratón asoma desde esquina inf-derecha.

CONTENIDO
  Texto en pantalla: "Redacte respuestas"
  Voiceover: "Deja que tu asistente de email con IA redacte respuestas..."
  
ANIMACIÓN
  · 0:07.0  Crossfade desde escena 02 (400ms)
  · 0:07.4  Texto entra palabra-a-palabra, stagger 80ms
  · 0:08.5  Cursor entra desde esq. inf-dcha, easing arc, 800ms
  · 0:09.5  Cursor "bounce" sobre el texto
  · 0:10.6  Inicia salida (texto fade + scale 0.95)
  
TRANSICIÓN SALIDA
  Push lateral hacia siguiente escena (sale por la izquierda).
══════════════════════════════════════
```

Usa este formato cuando el usuario es un cliente final o productor que quiere un brief detallado para pasar a un motion designer.

---

## Plantilla rellenable (esqueleto de 14 escenas)

Cuando empieces a planificar, llena este esqueleto:

```
ESCENA 01 — Hook (0:00–0:04)
  Layout: Hero + caos
  Texto: "Si tu [_____] se te hace [_____]"
  VO: "[ACTO 1 del guion]"
  Detalle: Sustantivo del problema reemplazado por icono amarillo en píldora.

ESCENA 02 — Lockup marca (0:04–0:07)
  Layout: Logo central
  Texto: "[NOMBRE MARCA] | [SUBLABEL OPCIONAL]"
  VO: silencio

ESCENA 03 — Solución intro (0:07–0:09)
  Layout: Hero claro
  Texto: "Deja que tu [____]"
  VO: "Deja que tu [_____] te ayude a..."

ESCENA 04 — Feature 1 (0:09–0:11)
  Layout: Hero violeta + cursor
  Texto: "[VERBO 1 + objeto]"
  VO: "[verbo 1 + complemento]..."

ESCENA 05 — Feature 1 demo (0:11–0:13)
  Layout: Píldora con UI fake
  Texto: "[Refuerzo o subtítulo]"
  VO: continuación

ESCENA 06 — Feature 2 con cards (0:13–0:15.5)
  Layout: Cards horizontales
  Texto: "[Categorías o columnas]"
  VO: "[verbo 2]..."

ESCENA 07 — Feature 3 (0:15.5–0:18)
  Layout: Elementos flotando + texto destacado
  Texto: "[VERBO 3 + objeto]"
  VO: "[verbo 3 + complemento]"

ESCENA 08 — Stat 1 (0:18–0:20.5)
  Layout: Píldora con icono
  Texto: "[STAT 1]"
  VO: "[stat 1]..."

ESCENA 09 — Stat 2 (0:20.5–0:23)
  Layout: Píldora con icono + animación símbolos
  Texto: "[STAT 2]"
  VO: "[stat 2]..."

ESCENA 10 — Stat 3 (0:23–0:25.5)
  Layout: Píldora con icono
  Texto: "[STAT 3]"
  VO: "[stat 3]"

ESCENA 11 — CTA aspiracional (0:25.5–0:28)
  Layout: Hero claro, palabra clave en violeta
  Texto: "[Frase aspiracional con palabra destacada]"
  VO: "[frase aspiracional]..."

ESCENA 12 — Demo final del producto (0:28–0:30)
  Layout: Mockup pseudo-real con efecto IA escribiendo
  Texto: contenido del mockup
  VO: "[CTA breve]"

ESCENA 13 — Lockup final (0:30–0:32)
  Layout: Logo central sobre violeta
  Texto: "[NOMBRE MARCA] | [SUBLABEL]"
  VO: cierre del CTA si queda
```

Si el video va a durar exactamente 30 s y no 32 s (lo más común), comprime las escenas 12 y 13 a 1.5 s cada una.

---

## Mapping del guion al storyboard

Para cada acto del guion, así se distribuye en escenas:

| Acto del guion | Escenas del storyboard |
|----------------|------------------------|
| Acto 1 (hook + problema) | Escena 1 |
| Acto 2 (lockup marca) | Escena 2 |
| Acto 3 (solución + features) | Escenas 3 a 7 |
| Acto 4 (stats) | Escenas 8 a 10 |
| Acto 5 (CTA + cierre) | Escenas 11 a 13 |

---

## Cómo presentar el storyboard al usuario

Después de tener el guion confirmado:

1. **Empieza con un párrafo breve** (2-3 frases) que explique la lógica narrativa: "El video sigue una estructura problema→marca→solución→stats→cierre. Cambia el fondo entre lavanda y violeta para crear ritmo. Total 30 s, ~14 escenas."

2. **Entrega la tabla compacta de 14 escenas**.

3. **Adjunta una nota de movimiento** al final con 3-4 puntos clave: "El cursor de ratón aparece en X escenas como elemento narrativo recurrente. Las transiciones entre fondos usan crossfade. La palabra '[X]' del acto 5 se destaca cambiando a color violeta saturado mientras el resto del texto se mantiene en negro grafito."

4. **Pregunta antes de implementar**: "¿Quieres que prepare directamente las escenas 1-3 en open-effects (PATCH del ProjectJson) para previsualizar en el editor, o antes prefieres ver una demo HTML+CSS rápida en navegador para validar el estilo?"

No entregues storyboard sin haber confirmado el guion previamente.
