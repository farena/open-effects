import React from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import type { AudioTrack } from "@open-effects/shared-types";
import { evalVolumeAtFrame } from "../keyframes/evalVolumeAtFrame";

/**
 * Wraps Remotion <Audio> in a <Sequence> so the track plays at
 * (globalOffsetFrames + track.startFrame), trimmed by [trimStart, trimEnd].
 *
 * `track.startFrame` is stored scene-local (the timeline UI sums the scene's
 * global start to position the strip). When this component is rendered
 * outside of the scene's Sequence (so audio survives past the scene
 * boundary), the caller passes `globalOffsetFrames = sceneStartFrame(...)`
 * to align it to the project's frame zero. Defaults to 0 for callers that
 * already render inside a scene wrapper.
 *
 * Volume is driven by evalVolumeAtFrame across track.volumeKeyframes. The
 * <Audio volume> callback receives the local frame within the wrapping
 * Sequence (frame 0 = track.startFrame), matching the volumeKeyframes
 * frame model.
 */
export const AudioTrackPlayer: React.FC<{
  track: AudioTrack;
  globalOffsetFrames?: number;
}> = ({ track, globalOffsetFrames = 0 }) => {
  const { fps } = useVideoConfig();
  const duration = Math.max(1, track.trimEnd - track.trimStart);
  return (
    <Sequence
      from={globalOffsetFrames + track.startFrame}
      durationInFrames={duration}
      layout="none"
    >
      <Audio
        src={track.assetPath}
        startFrom={track.trimStart}
        endAt={track.trimEnd}
        volume={(frame) => evalVolumeAtFrame(track.volumeKeyframes, frame, fps)}
      />
    </Sequence>
  );
};
