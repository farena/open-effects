/** Map common CSS color strings to #rrggbb for `<input type="color" />`. */
export function colorToHex(value: string): string {
  const trimmed = value.trim();
  const fullHex = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (fullHex) return "#" + fullHex[1].toLowerCase();
  const shortHex = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const s = shortHex[1];
    return (
      "#" +
      [...s]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  }
  const m = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return "#000000";
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function hexToRgba(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},1)`;
}

// ---------------------------------------------------------------------------
// Parser / serializer for the ColorPicker (solid + linear-gradient)
// ---------------------------------------------------------------------------

export type ColorStop = { position: number; hex: string; alpha: number };

export type ParsedColor =
  | { kind: "solid"; hex: string; alpha: number }
  | { kind: "gradient"; angle: number; stops: ColorStop[] }
  | { kind: "raw" };

/** Extract alpha from an `rgba(r,g,b,a)` token, defaulting to 1. */
function alphaFromRgbaString(value: string): number {
  const m = value.match(
    /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([0-9]*\.?[0-9]+))?\s*\)/,
  );
  if (!m || m[1] === undefined) return 1;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/** Split a string by top-level commas (ignoring commas inside parens). */
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of input) {
    if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth--;
      buf += ch;
    } else if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Map `to bottom`, `to right`, etc. to an angle in degrees. */
function directionalToAngle(token: string): number | null {
  const k = token.replace(/\s+/g, " ").trim().toLowerCase();
  switch (k) {
    case "to top":
      return 0;
    case "to right":
      return 90;
    case "to bottom":
      return 180;
    case "to left":
      return 270;
    case "to top right":
    case "to right top":
      return 45;
    case "to bottom right":
    case "to right bottom":
      return 135;
    case "to bottom left":
    case "to left bottom":
      return 225;
    case "to top left":
    case "to left top":
      return 315;
    default:
      return null;
  }
}

function parseStop(token: string, fallbackPosition: number): ColorStop | null {
  // token: "<color> <pos>%" or "<color>"
  // Color may be hex, rgb(...), or rgba(...).
  const posMatch = token.match(/(-?\d+(?:\.\d+)?)\s*%\s*$/);
  let colorPart = token;
  let position = fallbackPosition;
  if (posMatch) {
    position = parseFloat(posMatch[1]);
    colorPart = token.slice(0, token.length - posMatch[0].length).trim();
  }
  if (!colorPart) return null;
  const hex = colorToHex(colorPart);
  const alpha = alphaFromRgbaString(colorPart);
  return {
    position: Math.min(100, Math.max(0, position)),
    hex,
    alpha,
  };
}

export function parseColorValue(input: string): ParsedColor {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { kind: "solid", hex: "#000000", alpha: 1 };

  // linear-gradient(...)
  const grad = trimmed.match(/^linear-gradient\(\s*([\s\S]*)\s*\)\s*$/i);
  if (grad) {
    const inner = grad[1].trim();
    const parts = splitTopLevel(inner);
    if (parts.length === 0) return { kind: "raw" };

    let angle = 180;
    let stopParts = parts;

    const angleMatch = parts[0].match(/^(-?\d+(?:\.\d+)?)\s*deg$/i);
    const dir = directionalToAngle(parts[0]);
    if (angleMatch) {
      angle = parseFloat(angleMatch[1]);
      stopParts = parts.slice(1);
    } else if (dir != null) {
      angle = dir;
      stopParts = parts.slice(1);
    }

    if (stopParts.length < 2) return { kind: "raw" };

    const stops: ColorStop[] = [];
    stopParts.forEach((part, idx) => {
      const fallback = (idx / Math.max(1, stopParts.length - 1)) * 100;
      const s = parseStop(part, fallback);
      if (s) stops.push(s);
    });
    if (stops.length < 2) return { kind: "raw" };
    return { kind: "gradient", angle, stops };
  }

  // Solid (hex or rgb/rgba)
  if (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ||
    /^rgba?\(/i.test(trimmed)
  ) {
    return {
      kind: "solid",
      hex: colorToHex(trimmed),
      alpha: alphaFromRgbaString(trimmed),
    };
  }

  return { kind: "raw" };
}

export function buildSolid(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, alpha));
  if (a >= 1) return `rgba(${r},${g},${b},1)`;
  return `rgba(${r},${g},${b},${Number(a.toFixed(3))})`;
}

export function buildGradient(angle: number, stops: ColorStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const parts = sorted
    .map((s) => `${buildSolid(s.hex, s.alpha)} ${formatPosition(s.position)}%`)
    .join(", ");
  return `linear-gradient(${formatAngle(angle)}deg, ${parts})`;
}

function formatAngle(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  return Number.isInteger(a) ? String(a) : a.toFixed(1);
}

function formatPosition(position: number): string {
  const p = Math.min(100, Math.max(0, position));
  return Number.isInteger(p) ? String(p) : p.toFixed(2);
}
