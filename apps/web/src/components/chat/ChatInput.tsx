"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Square, ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatAttachment } from "@/types/chat";

const MAX_ATTACHMENTS = 8;
const ACCEPTED_IMAGE_PREFIX = "image/";

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  uploaded?: ChatAttachment;
  error?: string;
}

interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onStop?: () => void;
}

async function uploadImage(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/assets", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  const asset = (await res.json()) as { path: string; filename: string };
  return { path: asset.path, filename: asset.filename };
}

export function ChatInput({
  onSend,
  isStreaming,
  disabled,
  placeholder,
  suggestions,
  textareaRef: externalRef,
  onStop,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const textareaRef = externalRef || internalRef;

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // intentionally only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null);
      const incoming = Array.from(files).filter((f) =>
        f.type.startsWith(ACCEPTED_IMAGE_PREFIX),
      );
      if (incoming.length === 0) return;

      setPending((prev) => {
        const slots = MAX_ATTACHMENTS - prev.length;
        if (slots <= 0) {
          setGlobalError(`Max ${MAX_ATTACHMENTS} images per message`);
          return prev;
        }
        const accepted = incoming.slice(0, slots);
        if (incoming.length > slots) {
          setGlobalError(`Only ${slots} more image(s) allowed`);
        }
        const next = accepted.map<PendingAttachment>((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: "uploading",
        }));
        for (const att of next) {
          uploadImage(att.file)
            .then((uploaded) => {
              setPending((cur) =>
                cur.map((p) =>
                  p.id === att.id
                    ? { ...p, status: "done", uploaded }
                    : p,
                ),
              );
            })
            .catch((err: Error) => {
              setPending((cur) =>
                cur.map((p) =>
                  p.id === att.id
                    ? { ...p, status: "error", error: err.message }
                    : p,
                ),
              );
            });
        }
        return [...prev, ...next];
      });
    },
    [],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith(ACCEPTED_IMAGE_PREFIX)) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes("Files")) {
      dragCounterRef.current += 1;
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const uploadingCount = pending.filter((p) => p.status === "uploading").length;
  const hasErrored = pending.some((p) => p.status === "error");
  const canSend =
    !!value.trim() && !disabled && !isStreaming && uploadingCount === 0;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || uploadingCount > 0) return;
    const attachments = pending
      .filter((p) => p.status === "done" && p.uploaded)
      .map((p) => p.uploaded!) satisfies ChatAttachment[];
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    setGlobalError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  };

  return (
    <div
      className="border-t border-border p-3 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/10 border-2 border-dashed border-primary text-primary text-xs font-medium pointer-events-none">
          Drop images to attach
        </div>
      )}

      {value.length === 0 &&
        !isStreaming &&
        pending.length === 0 &&
        suggestions &&
        suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setValue(suggestion)}
                className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className="relative group h-14 w-14 rounded-md overflow-hidden border border-border bg-muted"
              title={p.error ?? p.file.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={p.file.name}
                className="h-full w-full object-cover"
              />
              {p.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                </div>
              )}
              {p.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-destructive-foreground text-[9px] text-center px-1">
                  Failed
                </div>
              )}
              <button
                type="button"
                onClick={() => removePending(p.id)}
                aria-label={`Remove ${p.file.name}`}
                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background/90 text-foreground flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(globalError || hasErrored) && (
        <div className="mb-2 text-[11px] text-destructive">
          {globalError ?? "One or more images failed to upload"}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || disabled || pending.length >= MAX_ATTACHMENTS}
          aria-label="Attach images"
          title="Attach images"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder={
            isStreaming ? "AI is working..." : placeholder ?? "Ask anything..."
          }
          disabled={isStreaming || disabled}
          rows={1}
          className="flex-1 resize-none bg-muted rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          aria-label="Chat message input"
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send message"
            title={
              uploadingCount > 0 ? "Waiting for images to finish uploading…" : undefined
            }
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
