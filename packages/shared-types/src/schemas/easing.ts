import { z } from "zod";
export const EasingSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("linear") }),
  z.object({ type: z.literal("ease-in") }),
  z.object({ type: z.literal("ease-out") }),
  z.object({ type: z.literal("ease-in-out") }),
  z.object({ type: z.literal("cubic-bezier"), params: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
  z.object({ type: z.literal("spring"), params: z.object({
    damping: z.number().positive(),
    stiffness: z.number().positive(),
    mass: z.number().positive()
  }) })
]);
