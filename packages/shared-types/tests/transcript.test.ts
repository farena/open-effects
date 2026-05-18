import { describe, it, expect } from "vitest";
import {
  TranscriptWordSchema,
  TranscriptSegmentSchema,
  TranscriptSchema,
} from "@/schemas/transcript";
import type { TranscriptWord, TranscriptSegment, Transcript } from "@/schemas/transcript";

describe("TranscriptWordSchema", () => {
  it("(a) accepts a valid word", () => {
    const result = TranscriptWordSchema.safeParse({
      text: "hello",
      startFrame: 0,
      endFrame: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const word: TranscriptWord = result.data;
      expect(word.text).toBe("hello");
    }
  });

  it("(c) rejects negative startFrame", () => {
    expect(
      TranscriptWordSchema.safeParse({
        text: "hello",
        startFrame: -1,
        endFrame: 10,
      }).success,
    ).toBe(false);
  });

  it("(c) rejects negative endFrame", () => {
    expect(
      TranscriptWordSchema.safeParse({
        text: "hello",
        startFrame: 0,
        endFrame: -5,
      }).success,
    ).toBe(false);
  });

  it("(d) preserves text field", () => {
    const result = TranscriptWordSchema.safeParse({
      text: "world",
      startFrame: 5,
      endFrame: 15,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("world");
    }
  });
});

describe("TranscriptSegmentSchema", () => {
  it("(a) accepts a full segment with words", () => {
    const result = TranscriptSegmentSchema.safeParse({
      id: "seg1",
      text: "Hello world",
      startFrame: 0,
      endFrame: 30,
      words: [
        { text: "Hello", startFrame: 0, endFrame: 15 },
        { text: "world", startFrame: 15, endFrame: 30 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const seg: TranscriptSegment = result.data;
      expect(seg.words).toHaveLength(2);
    }
  });

  it("(b) words defaults to [] when omitted", () => {
    const result = TranscriptSegmentSchema.safeParse({
      id: "seg1",
      text: "Hello world",
      startFrame: 0,
      endFrame: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.words).toEqual([]);
    }
  });

  it("(c) rejects negative startFrame", () => {
    expect(
      TranscriptSegmentSchema.safeParse({
        id: "seg1",
        text: "Hello",
        startFrame: -1,
        endFrame: 30,
      }).success,
    ).toBe(false);
  });

  it("(d) preserves text field", () => {
    const result = TranscriptSegmentSchema.safeParse({
      id: "seg1",
      text: "Test segment",
      startFrame: 0,
      endFrame: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("Test segment");
    }
  });
});

describe("TranscriptSchema", () => {
  it("(a) parses a full transcript", () => {
    const result = TranscriptSchema.safeParse({
      language: "en",
      model: "small",
      generatedAt: "2026-05-18T10:00:00.000Z",
      segments: [
        {
          id: "seg1",
          text: "Hello world",
          startFrame: 0,
          endFrame: 30,
          words: [{ text: "Hello", startFrame: 0, endFrame: 15 }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const transcript: Transcript = result.data;
      expect(transcript.language).toBe("en");
      expect(transcript.model).toBe("small");
      expect(transcript.segments).toHaveLength(1);
    }
  });

  it("(e) language is optional", () => {
    expect(
      TranscriptSchema.safeParse({
        segments: [],
      }).success,
    ).toBe(true);
  });

  it("(e) model is optional", () => {
    const result = TranscriptSchema.safeParse({
      language: "en",
      segments: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBeUndefined();
    }
  });

  it("(e) generatedAt is optional", () => {
    const result = TranscriptSchema.safeParse({
      segments: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generatedAt).toBeUndefined();
    }
  });

  it("(e) generatedAt rejects non-datetime string", () => {
    expect(
      TranscriptSchema.safeParse({
        generatedAt: "not-a-date",
        segments: [],
      }).success,
    ).toBe(false);
  });

  it("accepts empty segments array", () => {
    expect(
      TranscriptSchema.safeParse({ segments: [] }).success,
    ).toBe(true);
  });
});
