import { z } from "zod";

export const TranscriptWordSchema = z.object({
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
});

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  words: z.array(TranscriptWordSchema).default([]),
});

export const TranscriptSchema = z.object({
  language: z.string().optional(),
  model: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
  segments: z.array(TranscriptSegmentSchema),
});

export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
