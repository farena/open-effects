# Plantillas SVG / HTML+CSS animadas — **uso restringido**

> ⚠️ **Este archivo NO es para producción del video final.** El video final SIEMPRE se produce con la API de open-effects siguiendo `references/open-effects-integration.md` y `references/open-effects-components.md`.
>
> Este archivo se conserva solo para los siguientes casos de uso secundarios:
>
> 1. **Demo rápido en navegador para validar el estilo con el cliente** antes de invertir tiempo en montar el ProjectJson. Equivalente a "boceto en HTML".
> 2. **Bloque embebible en una landing web** que reproduzca una versión simplificada del video (no como video MP4 sino como HTML animado). Útil para hero sections.
> 3. **Referencia visual de los componentes** para entender el "qué" antes de traducirlo al "cómo" de open-effects.
>
> En los casos 1 y 2, las CSS animations sí funcionan porque el navegador las interpreta. En el video open-effects final NO son la primitiva nativa y no se renderizan deterministamente — los mismos efectos se replican con el array `keyframes` de cada layer (ver `references/open-effects-components.md`).

---

Implementaciones reutilizables en HTML+CSS+JS. Solo usar para los casos de uso secundarios listados arriba.

---

## Estructura general del archivo HTML

Cuando entregues una demo, usa un único archivo HTML autocontenido:

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>[Marca] — Promo</title>
<style>
:root {
  /* Paleta — sustituir por la marca destino */
  --bg-light: #EEEDFB;
  --bg-saturated: #6B5CFF;
  --text-dark: #1A1A2E;
  --text-light: #FFFFFF;
  --accent-yellow: #FFC93C;
  --accent-pink: #FF5C8A;
  --accent-blue: #7BB6FF;
  --shadow-icon: 0 12px 32px rgba(107, 92, 255, 0.25);
  --shadow-card: 0 4px 24px rgba(26, 26, 46, 0.08);
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --easing-spring-strong: cubic-bezier(0.68, -0.55, 0.27, 1.55);
  --easing-out: cubic-bezier(0.4, 0, 0.2, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
  background: var(--bg-light);
}

.stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
}

.scene.active { opacity: 1; }

.logo {
  position: absolute;
  top: 32px;
  left: 32px;
  height: 28px;
  z-index: 10;
}
</style>
</head>
<body>
<div class="stage">
  <!-- Logo persistente -->
  <svg class="logo" viewBox="0 0 120 28">...</svg>

  <!-- Escenas -->
  <div class="scene scene-1">...</div>
  <div class="scene scene-2">...</div>
  <!-- ... -->
</div>

<script>
  // Secuenciador de escenas (ver al final del archivo)
</script>
</body>
</html>
```

---

## Componente — Píldora con icono

```html
<div class="pill">
  <div class="pill-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- aquí el icono Lucide -->
      <path d="M22 2 11 13"/>
      <path d="m22 2-7 20-4-9-9-4Z"/>
    </svg>
  </div>
  <span class="pill-text">Texto de la feature</span>
</div>
```

```css
.pill {
  display: flex;
  align-items: center;
  gap: 32px;
}

.pill-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-saturated);
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-icon);
  transform: scale(0);
  animation: icon-in 600ms var(--easing-spring-strong) forwards;
}

.pill-icon svg {
  width: 40px;
  height: 40px;
  opacity: 0;
  animation: fade-in 400ms var(--easing-spring) 200ms forwards;
}

.pill-text {
  font-size: 64px;
  font-weight: 500;
  color: var(--text-dark);
  letter-spacing: -0.5%;
  opacity: 0;
  transform: translateX(-20px);
  animation: slide-in-left 500ms var(--easing-spring) 350ms forwards;
}

@keyframes icon-in {
  0% { transform: scale(0); }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes fade-in {
  to { opacity: 1; }
}

@keyframes slide-in-left {
  to { opacity: 1; transform: translateX(0); }
}
```

---

## Componente — Texto hero con animación palabra-a-palabra

```html
<h1 class="hero-text">
  <span class="word">Si</span>
  <span class="word">tu</span>
  <span class="word email-icon-wrap"><img src="email-icon.svg"></span>
  <span class="word">se</span>
  <span class="word">te</span>
  <span class="word">hace</span>
  <span class="word emphasis">pesado</span>
</h1>
```

```css
.hero-text {
  font-size: 80px;
  font-weight: 600;
  color: var(--text-dark);
  letter-spacing: -1.5%;
  text-align: center;
  line-height: 1.15;
  max-width: 80%;
}

.word {
  display: inline-block;
  opacity: 0;
  transform: translateY(20px);
  animation: word-in 500ms var(--easing-spring) both;
  margin-right: 0.25em;
}

.word.emphasis {
  display: block; /* fuerza salto de línea para "pesado" */
}

@keyframes word-in {
  to { opacity: 1; transform: translateY(0); }
}

/* Stagger automático con custom property */
.word:nth-child(1)  { animation-delay: 0ms;   }
.word:nth-child(2)  { animation-delay: 80ms;  }
.word:nth-child(3)  { animation-delay: 160ms; }
.word:nth-child(4)  { animation-delay: 240ms; }
.word:nth-child(5)  { animation-delay: 320ms; }
.word:nth-child(6)  { animation-delay: 400ms; }
.word:nth-child(7)  { animation-delay: 480ms; }
```

---

## Componente — Caos de notificaciones (acto 1)

```html
<div class="notif-cloud">
  <div class="notif" style="--x:15%; --y:20%; --r:-3deg; --delay:0ms;">
    <span class="notif-icon">⬜</span>
    <span class="notif-text">No hemos podido completar tu...</span>
  </div>
  <div class="notif" style="--x:65%; --y:15%; --r:2deg; --delay:120ms;">
    <span class="notif-text">Propuesta aprobada</span>
  </div>
  <!-- ...repetir 12-16 veces con posiciones distribuidas -->
</div>
```

```css
.notif-cloud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.notif {
  position: absolute;
  left: var(--x);
  top: var(--y);
  transform: translate(-50%, -50%) rotate(var(--r)) scale(0.8);
  background: white;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 16px;
  color: var(--text-dark);
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  opacity: 0;
  animation: 
    notif-in 600ms var(--easing-spring) var(--delay) forwards,
    notif-drift 4s ease-in-out var(--delay) infinite;
}

@keyframes notif-in {
  to { 
    opacity: 0.9; 
    transform: translate(-50%, -50%) rotate(var(--r)) scale(1); 
  }
}

@keyframes notif-drift {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -4px; }
}

/* Salida (al pasar a acto 2) */
.notif-cloud.exiting .notif {
  animation: notif-out 400ms var(--easing-out) forwards;
}

@keyframes notif-out {
  to {
    opacity: 0;
    transform: translate(-50%, -150%) rotate(var(--r)) scale(0.9);
  }
}
```

---

## Componente — Cursor de ratón animado

```html
<svg class="cursor" viewBox="0 0 24 24">
  <path d="M5 3 L5 18 L9 14 L11.5 19.5 L14 18.5 L11.5 13 L17 13 Z" 
        fill="#1A1A2E" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
```

```css
.cursor {
  position: absolute;
  width: 32px;
  height: 32px;
  bottom: -10%;
  right: -10%;
  z-index: 5;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  animation: cursor-arc 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards,
             cursor-bounce 600ms ease-in-out 800ms infinite;
}

@keyframes cursor-arc {
  0% {
    bottom: -10%;
    right: -10%;
    transform: scale(1);
  }
  60% {
    bottom: 30%;
    right: 30%;
    transform: scale(1.1);
  }
  100% {
    bottom: 35%;
    right: 38%;
    transform: scale(1);
  }
}

@keyframes cursor-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.05); }
}
```

---

## Componente — Cards de UI fake

```html
<div class="cards-row">
  <div class="ui-card" style="--delay:0ms">
    <div class="card-header">📁 Urgente</div>
    <div class="card-row"><span class="check"></span><span class="line"></span></div>
    <div class="card-row"><span class="check"></span><span class="line"></span></div>
    <div class="card-row"><span class="check"></span><span class="line"></span></div>
    <div class="card-row"><span class="check"></span><span class="line"></span></div>
  </div>
  <div class="ui-card" style="--delay:120ms"> ... </div>
  <div class="ui-card" style="--delay:240ms"> ... </div>
</div>
```

```css
.cards-row {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.ui-card {
  width: 280px;
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow-card);
  opacity: 0;
  transform: translateY(30px);
  animation: card-in 600ms var(--easing-spring) var(--delay) forwards;
}

.card-header {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-dark);
  margin-bottom: 16px;
}

.card-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.check {
  width: 16px;
  height: 16px;
  border: 1.5px solid #ccc;
  border-radius: 4px;
  flex-shrink: 0;
}

.line {
  height: 8px;
  flex: 1;
  background: #e5e5ec;
  border-radius: 4px;
}

@keyframes card-in {
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Blob de fondo decorativo

SVG inline, posicionado absolutamente, con blur:

```html
<svg class="bg-blob" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="blob-blur">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
  </defs>
  <ellipse cx="500" cy="450" rx="280" ry="180" 
           fill="#6B5CFF" opacity="0.18" 
           filter="url(#blob-blur)"/>
</svg>
```

```css
.bg-blob {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  animation: blob-drift 8s ease-in-out infinite;
}

@keyframes blob-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, 20px) scale(1.05); }
}
```

---

## Secuenciador de escenas (JS)

Para reproducir las escenas en orden con timings precisos:

```javascript
const scenes = [
  { selector: '.scene-1', duration: 4000 },
  { selector: '.scene-2', duration: 3000 },
  { selector: '.scene-3', duration: 2000 },
  { selector: '.scene-4', duration: 2000 },
  { selector: '.scene-5', duration: 2000 },
  { selector: '.scene-6', duration: 2500 },
  { selector: '.scene-7', duration: 2500 },
  { selector: '.scene-8', duration: 2500 },
  { selector: '.scene-9', duration: 2500 },
  { selector: '.scene-10', duration: 2500 },
  { selector: '.scene-11', duration: 2500 },
  { selector: '.scene-12', duration: 2000 },
  { selector: '.scene-13', duration: 2000 },
];

async function play() {
  for (const scene of scenes) {
    document.querySelectorAll('.scene.active').forEach(el => 
      el.classList.remove('active'));
    document.querySelector(scene.selector).classList.add('active');
    await new Promise(r => setTimeout(r, scene.duration));
  }
  // Loop opcional
  // setTimeout(play, 1000);
}

play();
```

---

## Cuándo usar SVG puro vs HTML+CSS

| Caso | Mejor opción |
|------|--------------|
| Demo web embebible | HTML + CSS + JS (más fácil de modificar) |
| Export para Lottie / motion designer externo | SVG estático con clases bien estructuradas + spec timings aparte |
| Banner estático (sin animar) | SVG puro con `<animate>` opcional |
| Render server-side a video MP4 | open-effects (PATCH ProjectJson + render endpoint), ver `references/open-effects-integration.md` |

---

## Limitaciones — qué NO intentar implementar en código

- **Voiceover**: este skill no genera audio. Solo produce el texto del guion para que el usuario lo grabe o use TTS.
- **El video completo de 30 s** en una sola pasada de código: implementa máximo 4-5 escenas como demo. Si el usuario quiere las 14, hazlo iterando.
- **Compositing pixel-perfect** comparable a After Effects. El estilo HTML+CSS aproxima, no replica al 100%, motion blur, glow detallado, ni ciertos easings del motion graphics profesional.

Si el usuario necesita la versión animada definitiva, **úsa open-effects** (PATCH ProjectJson + render) — el guion + storyboard + visual-system + plantillas de `open-effects-components.md` bastan para producir el video en formato MP4.
