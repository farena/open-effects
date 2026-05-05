"use client";

import { useEditorStore } from "@/editor/store";
import {
  selectActiveAudioTrack,
  selectVolumeKeyframes,
} from "@/editor/selectors";
import type { Easing, VolumeKeyframe } from "@open-effects/shared-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { EasingEditor } from "./EasingEditor";
import { EqEditor } from "./EqEditor";

// ---------------------------------------------------------------------------
// Default linear easing
// ---------------------------------------------------------------------------

const LINEAR_EASING: Easing = { type: "linear" };

// ---------------------------------------------------------------------------
// Volume keyframe row
// ---------------------------------------------------------------------------

interface VolumeKeyframeRowProps {
  trackId: string;
  keyframe: VolumeKeyframe;
}

function VolumeKeyframeRow({ trackId, keyframe }: VolumeKeyframeRowProps) {
  const updateVolumeKeyframeValue = useEditorStore(
    (s) => s.updateVolumeKeyframeValue,
  );
  const updateVolumeKeyframeEasing = useEditorStore(
    (s) => s.updateVolumeKeyframeEasing,
  );
  const deleteVolumeKeyframe = useEditorStore((s) => s.deleteVolumeKeyframe);

  function handleVolumeChange([v]: number[]) {
    updateVolumeKeyframeValue(trackId, keyframe.frame, v);
  }

  function handleEasingSave(next: Easing) {
    updateVolumeKeyframeEasing(trackId, keyframe.frame, next);
  }

  function handleDelete() {
    deleteVolumeKeyframe(trackId, keyframe.frame);
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Frame label */}
      <div className="flex w-14 shrink-0 flex-col gap-0.5">
        <Label className="text-xs text-muted-foreground">Frame</Label>
        <span className="text-xs tabular-nums">{keyframe.frame}</span>
      </div>

      {/* Volume slider */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label className="text-xs text-muted-foreground">
          Volume ({keyframe.value.toFixed(2)})
        </Label>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[keyframe.value]}
          onValueChange={handleVolumeChange}
          aria-label="Volume"
        />
      </div>

      {/* Easing */}
      <div className="flex shrink-0 flex-col gap-0.5">
        <Label className="text-xs text-muted-foreground">Easing</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              data-testid="volume-easing-button"
            >
              {keyframe.easingOut.type}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <EasingEditor
              easing={keyframe.easingOut}
              onSave={handleEasingSave}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Delete */}
      <div className="mt-4 flex shrink-0 flex-col gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={handleDelete}
          aria-label="Delete volume keyframe"
        >
          <span className="text-sm leading-none">x</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AudioFxTab() {
  const track = useEditorStore(selectActiveAudioTrack);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const fps = useEditorStore((s) => s.project.fps);
  const volumeKeyframes = useEditorStore(selectVolumeKeyframes);
  const addVolumeKeyframe = useEditorStore((s) => s.addVolumeKeyframe);

  if (!track) return null;

  const localFrame = Math.max(0, currentFrame - track.startFrame);

  const sortedKeyframes = [...volumeKeyframes].sort(
    (a, b) => a.frame - b.frame,
  );

  function handleAddKeyframe() {
    if (!track) return;
    addVolumeKeyframe(track.id, localFrame, 1, LINEAR_EASING);
  }

  // fps is read but available for potential future display (e.g. time code)
  void fps;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Audio FX
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          frame {localFrame}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Section 1 — Volume keyframes */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Volume keyframes</span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={handleAddKeyframe}
            >
              + Add keyframe @ frame {localFrame}
            </Button>
          </div>

          {sortedKeyframes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No volume keyframes yet. Add one to animate the volume over time.
            </p>
          ) : (
            <div className="flex flex-col">
              {sortedKeyframes.map((kf) => (
                <VolumeKeyframeRow
                  key={kf.frame}
                  trackId={track.id}
                  keyframe={kf}
                />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Section 2 — EQ */}
        <EqEditor track={track} />
      </div>
    </div>
  );
}
