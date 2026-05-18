import { describe, it, expect } from "vitest";
import { mapWhisperResponse } from "@/lib/transcript/mapWhisperResponse";

const fixtureRaw = {
  text: "Hello world. How are you? Fine thanks.",
  language: "en",
  segments: [
    {
      id: 0,
      start: 0.0,
      end: 2.5,
      text: "Hello world.",
      words: [
        { start: 0.0, end: 0.8, word: " Hello", probability: 0.99 },
        { start: 0.9, end: 1.5, word: " world.", probability: 0.97 },
        { start: 1.6, end: 2.5, word: "  ", probability: 0.1 }, // whitespace-only — should be filtered
      ],
    },
    {
      id: 1,
      start: 3.0,
      end: 5.0,
      text: "How are you?",
      words: [
        { start: 3.0, end: 3.5, word: " How", probability: 0.95 },
        { start: 3.6, end: 3.9, word: " are", probability: 0.96 },
        { start: 4.0, end: 4.8, word: " you?", probability: 0.98 },
      ],
    },
    {
      id: 2,
      start: 5.5,
      end: 7.0,
      text: "Fine thanks.",
      words: [
        { start: 5.5, end: 6.0, word: " Fine", probability: 0.99 },
        { start: 6.1, end: 7.0, word: " thanks.", probability: 0.97 },
      ],
    },
  ],
};

describe("mapWhisperResponse", () => {
  it("maps segments to correct frames at 30fps", () => {
    const result = mapWhisperResponse(fixtureRaw, 30, "small");

    expect(result.segments).toHaveLength(3);

    // segment 0: start=0.0s -> 0, end=2.5s -> 75
    expect(result.segments[0].startFrame).toBe(0);
    expect(result.segments[0].endFrame).toBe(75);

    // segment 1: start=3.0s -> 90, end=5.0s -> 150
    expect(result.segments[1].startFrame).toBe(90);
    expect(result.segments[1].endFrame).toBe(150);

    // segment 2: start=5.5s -> 165, end=7.0s -> 210
    expect(result.segments[2].startFrame).toBe(165);
    expect(result.segments[2].endFrame).toBe(210);
  });

  it("maps segments to correct frames at 60fps", () => {
    const result = mapWhisperResponse(fixtureRaw, 60, "small");

    // segment 0: start=0.0s -> 0, end=2.5s -> 150
    expect(result.segments[0].startFrame).toBe(0);
    expect(result.segments[0].endFrame).toBe(150);

    // segment 1: start=3.0s -> 180, end=5.0s -> 300
    expect(result.segments[1].startFrame).toBe(180);
    expect(result.segments[1].endFrame).toBe(300);
  });

  it("maps words to correct frames at 30fps", () => {
    const result = mapWhisperResponse(fixtureRaw, 30, "small");

    // segment 0 words: "Hello" and "world." (whitespace word filtered)
    expect(result.segments[0].words).toHaveLength(2);
    expect(result.segments[0].words[0].text).toBe("Hello");
    // word start=0.0 -> 0, end=0.8 -> round(24) = 24
    expect(result.segments[0].words[0].startFrame).toBe(0);
    expect(result.segments[0].words[0].endFrame).toBe(24);

    expect(result.segments[0].words[1].text).toBe("world.");
    // word start=0.9 -> round(27) = 27, end=1.5 -> round(45) = 45
    expect(result.segments[0].words[1].startFrame).toBe(27);
    expect(result.segments[0].words[1].endFrame).toBe(45);
  });

  it("filters out empty and whitespace-only words", () => {
    const result = mapWhisperResponse(fixtureRaw, 30, "small");
    // segment 0 has 3 words in the fixture, 1 is whitespace-only → expect 2
    expect(result.segments[0].words).toHaveLength(2);
    // no empty text words in any segment
    for (const seg of result.segments) {
      for (const word of seg.words) {
        expect(word.text.trim()).not.toBe("");
      }
    }
  });

  it("trims leading/trailing spaces from word text", () => {
    const result = mapWhisperResponse(fixtureRaw, 30, "small");
    for (const seg of result.segments) {
      for (const word of seg.words) {
        expect(word.text).toBe(word.text.trim());
      }
    }
  });

  it("clamps endFrame >= startFrame for segments", () => {
    const rawWithZeroEnd = {
      text: "test",
      language: "en",
      segments: [
        {
          id: "seg-0",
          start: 2.0,
          end: 1.0, // end < start — should be clamped
          text: "test",
          words: [],
        },
      ],
    };
    const result = mapWhisperResponse(rawWithZeroEnd, 30, "small");
    expect(result.segments[0].endFrame).toBeGreaterThanOrEqual(
      result.segments[0].startFrame,
    );
  });

  it("uses segment id as string when provided", () => {
    const result = mapWhisperResponse(fixtureRaw, 30, "small");
    expect(result.segments[0].id).toBe("0");
    expect(result.segments[1].id).toBe("1");
    expect(result.segments[2].id).toBe("2");
  });

  it("generates a non-empty newId placeholder when segment id is missing", () => {
    const rawNoId = {
      text: "hi",
      language: "en",
      segments: [
        {
          start: 0.0,
          end: 1.0,
          text: "hi",
          words: [],
        },
      ],
    };
    const result = mapWhisperResponse(rawNoId, 30, "small");
    expect(result.segments[0].id).toBeTruthy();
    expect(typeof result.segments[0].id).toBe("string");
    expect(result.segments[0].id.length).toBeGreaterThan(0);
  });

  it("populates metadata fields from arguments", () => {
    const result = mapWhisperResponse(fixtureRaw, 30, "medium");
    expect(result.language).toBe("en");
    expect(result.model).toBe("medium");
    expect(result.generatedAt).toBeTruthy();
    // generatedAt is a valid ISO datetime string
    expect(() => new Date(result.generatedAt!)).not.toThrow();
  });

  it("rounds frames correctly at non-integer fps", () => {
    // At 25fps: 1.0s -> 25, 1.02s -> round(25.5) = 26
    const raw = {
      text: "hi",
      language: "en",
      segments: [
        {
          id: 0,
          start: 1.02,
          end: 2.0,
          text: "hi",
          words: [],
        },
      ],
    };
    const result = mapWhisperResponse(raw, 25, "small");
    expect(result.segments[0].startFrame).toBe(26);
    expect(result.segments[0].endFrame).toBe(50);
  });
});
