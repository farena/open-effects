import { z } from "zod";

/**
 * One line of the voice-over script.
 *
 * `timestamp` is a free-form string ("00:00", "01:23.5", "00:00:12") so the
 * user can paste timecodes from any source. The agent should keep them in
 * sequential order; the API does not enforce parseability.
 */
export const VideoScriptLineSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().max(20).default("00:00"),
  text: z.string().max(2000).default(""),
});

export type VideoScriptLine = z.infer<typeof VideoScriptLineSchema>;

export const VideoScriptSchema = z.array(VideoScriptLineSchema);

export type VideoScript = z.infer<typeof VideoScriptSchema>;

export const VideoScriptPutSchema = z.object({
  lines: VideoScriptSchema,
});

export type VideoScriptPut = z.infer<typeof VideoScriptPutSchema>;
