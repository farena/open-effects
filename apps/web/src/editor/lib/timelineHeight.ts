export const TIMELINE_HEIGHT_KEY = "oe-editor-timeline-h";
export const TIMELINE_MIN = 250;
export const TIMELINE_HARD_MAX = 900;
export const TIMELINE_DEFAULT = 300;

export function clampTimelineHeight(h: number, viewportH: number): number {
  if (!Number.isFinite(h)) return TIMELINE_DEFAULT;
  const upper = Math.min(Math.floor(viewportH * 0.45), TIMELINE_HARD_MAX);
  return Math.max(TIMELINE_MIN, Math.min(upper, h));
}

export function readSavedHeight(): number | null {
  try {
    const raw = localStorage.getItem(TIMELINE_HEIGHT_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeSavedHeight(h: number): void {
  try {
    localStorage.setItem(TIMELINE_HEIGHT_KEY, String(h));
  } catch {
    // ignore
  }
}
