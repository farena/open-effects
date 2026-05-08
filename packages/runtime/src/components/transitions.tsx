import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { linearTiming } from "@remotion/transitions";
import type { Transition } from "@open-effects/shared-types";

export type TransitionConfig = {
  presentation: ReturnType<typeof fade> | ReturnType<typeof slide>;
  timing: ReturnType<typeof linearTiming>;
};

export function mapTransitionToPreset(t: Transition): TransitionConfig | null {
  if (t.type === "none") return null;
  const timing = linearTiming({ durationInFrames: t.durationFrames });
  switch (t.type) {
    case "fade":
      return { presentation: fade(), timing };
    case "slide-left":
      return {
        presentation: slide({ direction: "from-right" }),
        timing,
      };
    case "slide-right":
      return {
        presentation: slide({ direction: "from-left" }),
        timing,
      };
    case "slide-up":
      return {
        presentation: slide({ direction: "from-bottom" }),
        timing,
      };
    case "slide-down":
      return {
        presentation: slide({ direction: "from-top" }),
        timing,
      };
    default: {
      const _exhaustive: never = t.type;
      void _exhaustive;
      return null;
    }
  }
}
