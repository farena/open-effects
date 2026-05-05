import React from "react";
import { Audio, Sequence } from "remotion";
import type { AudioTrack } from "@open-effects/shared-types";

/**
 * Wraps Remotion <Audio> in a <Sequence> so the track plays at scene start
 * + track.startFrame, trimmed by [trimStart, trimEnd] (all in project frames).
 *
 * Volume is delegated to a function in Stage 6. For Stage 5 it's constant 1.
 */
export const AudioTrackPlayer: React.FC<{ track: AudioTrack }> = ({
  track,
}) => {
  const duration = Math.max(1, track.trimEnd - track.trimStart);
  return (
    <Sequence from={track.startFrame} durationInFrames={duration} layout="none">
      <Audio
        src={track.assetPath}
        startFrom={track.trimStart}
        endAt={track.trimEnd}
      />
    </Sequence>
  );
};
