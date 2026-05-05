import { describe, it, expect, vi } from "vitest";

vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Audio: ({
      src,
      volume,
    }: {
      src: string;
      volume?: number | ((frame: number) => number);
    }) => (
      <audio
        src={src}
        data-volume-fn={typeof volume === "function" ? "function" : "other"}
      />
    ),
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 30,
      width: 1920,
      height: 1080,
    }),
  };
});

import React from "react";
import { render } from "@testing-library/react";
import { AudioTrackPlayer } from "@/components/AudioTrackPlayer";
import type { AudioTrack } from "@open-effects/shared-types";

const baseTrack: AudioTrack = {
  id: "A1",
  assetId: "asset-1",
  assetPath: "/media/audio/track.mp3",
  startFrame: 0,
  trimStart: 0,
  trimEnd: 30,
  volumeKeyframes: [],
};

describe("<AudioTrackPlayer>", () => {
  it("renders an <audio> element with src matching assetPath", () => {
    const { container } = render(<AudioTrackPlayer track={baseTrack} />);
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio!.getAttribute("src")).toBe(baseTrack.assetPath);
  });

  it("renders <audio> with a different assetPath", () => {
    const track: AudioTrack = {
      ...baseTrack,
      assetPath: "/media/audio/voice.wav",
    };
    const { container } = render(<AudioTrackPlayer track={track} />);
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio!.getAttribute("src")).toBe("/media/audio/voice.wav");
  });

  it("passes a volume function when volumeKeyframes are provided", () => {
    const track: AudioTrack = {
      ...baseTrack,
      volumeKeyframes: [
        { frame: 0, value: 0, easingOut: { type: "linear" } },
        { frame: 30, value: 1, easingOut: { type: "linear" } },
      ],
    };
    const { container } = render(<AudioTrackPlayer track={track} />);
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio!.getAttribute("data-volume-fn")).toBe("function");
  });
});
