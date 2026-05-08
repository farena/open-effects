import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clampTimelineHeight,
  readSavedHeight,
  TIMELINE_DEFAULT,
  TIMELINE_HEIGHT_KEY,
  TIMELINE_MIN,
} from "@/editor/lib/timelineHeight";

describe("clampTimelineHeight", () => {
  it("clamps down to upper bound when h exceeds 45% viewport cap", () => {
    // viewport 1000 → max = min(floor(1000 * 0.45), 900) = min(450, 900) = 450
    expect(clampTimelineHeight(800, 1000)).toBe(450);
  });

  it("returns h unchanged when within bounds (hard cap applies)", () => {
    // viewport 2400 → max = min(floor(2400 * 0.45), 900) = min(1080, 900) = 900
    // h=800 is within [250, 900], so returns 800
    expect(clampTimelineHeight(800, 2400)).toBe(800);
  });

  it("clamps up to TIMELINE_MIN when h is below minimum", () => {
    // viewport 1000 → upper = 450; h=100 < 250 → returns 250
    expect(clampTimelineHeight(100, 1000)).toBe(TIMELINE_MIN);
  });

  it("returns TIMELINE_DEFAULT when h is NaN", () => {
    expect(clampTimelineHeight(NaN, 1000)).toBe(TIMELINE_DEFAULT);
  });
});

describe("readSavedHeight", () => {
  // localStorage is not available in node test environment; stub it
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
  });

  it("returns null when localStorage key is absent", () => {
    expect(readSavedHeight()).toBeNull();
  });

  it("returns null when value is not a finite number", () => {
    localStorage.setItem(TIMELINE_HEIGHT_KEY, "notanumber");
    expect(readSavedHeight()).toBeNull();
  });

  it("returns the stored number when value is a valid integer", () => {
    localStorage.setItem(TIMELINE_HEIGHT_KEY, "350");
    expect(readSavedHeight()).toBe(350);
  });
});
