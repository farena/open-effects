"use client";

import { useState, useRef } from "react";
import { ChevronRight, ChevronDown, Plus, Trash2, RefreshCw } from "lucide-react";
import { useEditorStore } from "@/editor/store";
import { selectActiveLayer } from "@/editor/selectors";
import { newId } from "@/lib/ids";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/editor/components/ConfirmDialog";
import type { SubtitleLayer } from "@open-effects/shared-types";
import type { TranscriptSegment, Transcript } from "@open-effects/shared-types";

const DEBOUNCE_MS = 300;

type SegmentRowProps = {
  segment: TranscriptSegment;
  index: number;
  onUpdate: (patch: Partial<TranscriptSegment>) => void;
  onDelete: () => void;
};

function SegmentRow({ segment, index, onUpdate, onDelete }: SegmentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleStartFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    onUpdate({ startFrame: value });
  }

  function handleEndFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    onUpdate({ endFrame: value });
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      onUpdate({ text });
    }, DEBOUNCE_MS);
  }

  return (
    <li className="rounded border border-[#2d2d2d] bg-[#1d1f23] overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-[#666] hover:text-[#aaa] transition-colors"
          aria-label={expanded ? "Collapse words" : "Expand words"}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>

        <span className="shrink-0 text-[10px] text-[#555] font-mono w-4">
          {index + 1}
        </span>

        <Input
          defaultValue={segment.text}
          onChange={handleTextChange}
          maxLength={2000}
          className="min-w-0 flex-1 h-6 text-xs bg-[#14161a] border-[#2d2d2d] text-[#ccc] px-1.5"
          aria-label={`Segment ${index + 1} text`}
        />

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-[#555]">S</span>
          <DraggableNumberInput
            value={segment.startFrame}
            onChange={handleStartFrameChange}
            min={0}
            className="w-14 h-6 text-xs bg-[#14161a] border-[#2d2d2d] text-[#aaa] px-1"
            aria-label={`Segment ${index + 1} start frame`}
          />
          <span className="text-[10px] text-[#555]">E</span>
          <DraggableNumberInput
            value={segment.endFrame}
            onChange={handleEndFrameChange}
            min={0}
            className="w-14 h-6 text-xs bg-[#14161a] border-[#2d2d2d] text-[#aaa] px-1"
            aria-label={`Segment ${index + 1} end frame`}
          />
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-0.5 text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors"
          aria-label={`Delete segment ${index + 1}`}
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {expanded && segment.words.length > 0 && (
        <div className="border-t border-[#2d2d2d] px-3 py-2 space-y-1">
          {segment.words.map((word, wi) => (
            <div
              key={wi}
              className="flex items-center gap-2 text-[11px] text-[#888]"
            >
              <span className="flex-1 font-mono truncate">{word.text}</span>
              <span className="text-[#555]">S:{word.startFrame}</span>
              <span className="text-[#555]">E:{word.endFrame}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && segment.words.length === 0 && (
        <div className="border-t border-[#2d2d2d] px-3 py-1.5 text-[11px] text-[#555] italic">
          No word-level data
        </div>
      )}
    </li>
  );
}

export function SubtitlePropsTab() {
  const layer = useEditorStore(selectActiveLayer);
  const updateLayerName = useEditorStore((s) => s.updateLayerName);
  const updateLayerFrames = useEditorStore((s) => s.updateLayerFrames);
  const updateSubtitleTranscript = useEditorStore(
    (s) => s.updateSubtitleTranscript,
  );
  const regenerateSubtitleLayer = useEditorStore(
    (s) => s.regenerateSubtitleLayer,
  );

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!layer || layer.type !== "subtitle") return null;

  const subtitleLayer = layer as SubtitleLayer;
  const transcript = subtitleLayer.subtitle.transcript;

  function handleSegmentUpdate(
    segId: string,
    patch: Partial<TranscriptSegment>,
  ) {
    const nextTranscript: Transcript = {
      ...transcript,
      segments: transcript.segments.map((s) =>
        s.id === segId ? { ...s, ...patch } : s,
      ),
    };
    updateSubtitleTranscript(subtitleLayer.id, nextTranscript);
  }

  function handleDeleteSegment(segId: string) {
    const nextTranscript: Transcript = {
      ...transcript,
      segments: transcript.segments.filter((s) => s.id !== segId),
    };
    updateSubtitleTranscript(subtitleLayer.id, nextTranscript);
  }

  function handleAddSegment() {
    const last = transcript.segments[transcript.segments.length - 1];
    const startFrame = last ? last.endFrame + 1 : 0;
    const endFrame = startFrame + 60;
    const newSegment: TranscriptSegment = {
      id: newId("seg_"),
      text: "New segment",
      startFrame,
      endFrame,
      words: [],
    };
    const nextTranscript: Transcript = {
      ...transcript,
      segments: [...transcript.segments, newSegment],
    };
    updateSubtitleTranscript(subtitleLayer.id, nextTranscript);
  }

  function handleRegenerate() {
    if (subtitleLayer.subtitle.manualOverride) {
      setConfirmOpen(true);
    } else {
      regenerateSubtitleLayer(subtitleLayer.id);
    }
  }

  function handleConfirmRegenerate() {
    regenerateSubtitleLayer(subtitleLayer.id);
  }

  function handleStartFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    updateLayerFrames(subtitleLayer.id, value, subtitleLayer.endFrame);
  }

  function handleEndFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    updateLayerFrames(subtitleLayer.id, subtitleLayer.startFrame, value);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#2d2d2d] px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Transcript
        </span>
      </div>

      {/* Controls */}
      <div className="shrink-0 border-b border-[#2d2d2d] space-y-2 p-3">
        {/* Layer name */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="subtitle-layer-name" className="text-xs text-[#aaa]">
            Name
          </Label>
          <Input
            id="subtitle-layer-name"
            value={subtitleLayer.name}
            onChange={(e) => updateLayerName(subtitleLayer.id, e.target.value)}
            className="h-7 text-xs bg-[#14161a] border-[#2d2d2d] text-[#ccc]"
            placeholder="Layer name"
          />
        </div>

        {/* Start / End frames */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <Label
              htmlFor="subtitle-start-frame"
              className="text-xs text-[#aaa]"
            >
              Start
            </Label>
            <DraggableNumberInput
              id="subtitle-start-frame"
              value={subtitleLayer.startFrame}
              onChange={handleStartFrameChange}
              min={0}
              className="h-7 text-xs bg-[#14161a] border-[#2d2d2d] text-[#aaa]"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <Label
              htmlFor="subtitle-end-frame"
              className="text-xs text-[#aaa]"
            >
              End
            </Label>
            <DraggableNumberInput
              id="subtitle-end-frame"
              value={subtitleLayer.endFrame}
              onChange={handleEndFrameChange}
              min={0}
              className="h-7 text-xs bg-[#14161a] border-[#2d2d2d] text-[#aaa]"
            />
          </div>
        </div>

        {/* Regenerate + manual override badge */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            className="h-7 gap-1 text-xs border-[#2d2d2d] bg-[#14161a] text-[#aaa] hover:bg-[#2d2d2d] hover:text-white"
          >
            <RefreshCw className="size-3" />
            Regenerate HTML+keyframes
          </Button>
          {subtitleLayer.subtitle.manualOverride && (
            <span className="rounded-full bg-amber-700/40 px-2 py-0.5 text-[10px] text-amber-200 whitespace-nowrap">
              Manual override
            </span>
          )}
        </div>
      </div>

      {/* Segment list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <ul className="flex flex-col gap-1.5">
          {transcript.segments.map((seg, i) => (
            <SegmentRow
              key={seg.id}
              segment={seg}
              index={i}
              onUpdate={(patch) => handleSegmentUpdate(seg.id, patch)}
              onDelete={() => handleDeleteSegment(seg.id)}
            />
          ))}
        </ul>

        {transcript.segments.length === 0 && (
          <p className="text-xs text-[#555] italic text-center py-4">
            No segments yet. Add one below.
          </p>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleAddSegment}
          className="w-full h-7 gap-1 text-xs text-[#666] hover:text-[#aaa] hover:bg-[#1d1f23] border border-dashed border-[#2d2d2d]"
        >
          <Plus className="size-3" />
          Add segment
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Regenerate subtitle layer?"
        description="Your manual edits to HTML/keyframes will be overwritten. CSS is preserved. Continue?"
        confirmLabel="Regenerate"
        destructive
        onConfirm={handleConfirmRegenerate}
      />
    </div>
  );
}
