import React from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import type { AudioTrack } from "@open-effects/shared-types";
import { evalVolumeAtFrame } from "../keyframes/evalVolumeAtFrame";

/**
 * Wraps Remotion <Audio> in a <Sequence> so the track plays at scene start
 * + track.startFrame, trimmed by [trimStart, trimEnd] (all in project frames).
 *
 * Volume is driven by evalVolumeAtFrame, which interpolates across
 * track.volumeKeyframes. The <Audio volume> callback receives the local frame
 * within the wrapping Sequence (frame 0 = track.startFrame), matching the
 * volumeKeyframes frame model.
 */
export const AudioTrackPlayer: React.FC<{ track: AudioTrack }> = ({
  track,
}) => {
  const { fps } = useVideoConfig();
  const duration = Math.max(1, track.trimEnd - track.trimStart);
  return (
    <Sequence from={track.startFrame} durationInFrames={duration} layout="none">
      <Audio
        src={track.assetPath}
        startFrom={track.trimStart}
        endAt={track.trimEnd}
        volume={(frame) => evalVolumeAtFrame(track.volumeKeyframes, frame, fps)}
      />
    </Sequence>
  );
};
