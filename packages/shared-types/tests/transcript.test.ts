import { describe, it, expect } from "vitest";
import {
  TranscriptSegmentSchema,
  TranscriptSchema,
} from "@/schemas/transcript";
import type { TranscriptSegment, Transcript } from "@/schemas/transcript";

describe("TranscriptSegmentSchema", () => {
  it("(a) accepts a valid segment", () => {
    const result = TranscriptSegmentSchema.safeParse({
      id: "seg1",
      text: "Hello world",
      startFrame: 0,
      endFrame: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const seg: TranscriptSegment = result.data;
      expect(seg.text).toBe("Hello world");
    }
  });

  it("(b) rejects negative startFrame", () => {
    expect(
      TranscriptSegmentSchema.safeParse({
        id: "seg1",
        text: "Hello",
        startFrame: -1,
        endFrame: 30,
      }).success,
    ).toBe(false);
  });

  it("(c) ignores legacy `words` field — segments are word-frame-free now", () => {
    // Pre-refactor transcripts persisted a `words` array per segment. They
    // still round-trip cleanly because Zod's default `.strip()` policy drops
    // unknown keys silently.
    const result = TranscriptSegmentSchema.safeParse({
      id: "seg1",
      text: "Hello world",
      startFrame: 0,
      endFrame: 30,
      words: [{ text: "Hello", startFrame: 0, endFrame: 15 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // No `words` property on the parsed output type
      expect((result.data as Record<string, unknown>).words).toBeUndefined();
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
    expect(TranscriptSchema.safeParse({ segments: [] }).success).toBe(true);
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
    expect(TranscriptSchema.safeParse({ segments: [] }).success).toBe(true);
  });
});
