"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { useChatStream } from "@/lib/use-chat-stream";
import { AlertCircle, Plug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatAttachment } from "@/types/chat";
import type { Project } from "@open-effects/shared-types";
import { useEditorStore } from "@/editor/store";

interface ProjectChatProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

const CHAT_WIDTH_KEY = "oe-project-chat-width";
const DEFAULT_CHAT_WIDTH = 420;
const MIN_CHAT_WIDTH = 320;
// Cap at 50% of the viewport — re-evaluated against window.innerWidth on every drag.
const MAX_CHAT_VIEWPORT_FRACTION = 0.5;

function clampChatWidth(n: number, viewportW: number): number {
  const max = Math.max(
    MIN_CHAT_WIDTH,
    Math.floor(viewportW * MAX_CHAT_VIEWPORT_FRACTION),
  );
  return Math.min(max, Math.max(MIN_CHAT_WIDTH, Math.round(n)));
}

export function ProjectChat({
  projectId,
  projectName,
  open,
  onClose,
}: ProjectChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);

  // Resizable panel width — persisted in localStorage, capped at 50% viewport.
  const [width, setWidth] = useState<number>(DEFAULT_CHAT_WIDTH);
  const widthRef = useRef<number>(DEFAULT_CHAT_WIDTH);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(DEFAULT_CHAT_WIDTH);

  const storageKey = `oe-chat-messages-project-${projectId}`;
  const sessionKey = `oe-chat-session-project-${projectId}`;

  const replaceProjectFromServer = useEditorStore(
    (s) => s.replaceProjectFromServer,
  );

  const refreshProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const project = (await res.json()) as Project;
      replaceProjectFromServer(project);
      toast.success("Project updated by AI", { duration: 1500 });
    } catch (err) {
      console.error("[project-chat] failed to refresh project", err);
      toast.error("Could not refresh project", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [projectId, replaceProjectFromServer]);

  const { messages, isStreaming, error, send, clear, stop } = useChatStream({
    storageKey,
    sessionKey,
    onStreamEnd: (usedTools) => {
      if (usedTools) void refreshProject();
    },
  });

  // Hydrate width from localStorage on first open and clamp to current viewport.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(CHAT_WIDTH_KEY);
      const parsed = raw == null ? NaN : Number.parseInt(raw, 10);
      const initial = Number.isFinite(parsed) ? parsed : DEFAULT_CHAT_WIDTH;
      const clamped = clampChatWidth(initial, window.innerWidth);
      widthRef.current = clamped;
      setWidth(clamped);
    } catch {
      // ignore
    }
  }, []);

  // Re-clamp on viewport resize so a shrinking window cannot leave the panel
  // wider than 50% vw.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf: number | null = null;
    const onResize = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setWidth((prev) => {
          const next = clampChatWidth(prev, window.innerWidth);
          if (next !== prev) {
            widthRef.current = next;
            try {
              localStorage.setItem(CHAT_WIDTH_KEY, String(next));
            } catch {
              // ignore
            }
          }
          return next;
        });
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = widthRef.current;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      // Panel sits flush right; dragging the left edge LEFT increases width.
      const delta = dragStartXRef.current - e.clientX;
      const next = clampChatWidth(
        dragStartWidthRef.current + delta,
        window.innerWidth,
      );
      widthRef.current = next;
      setWidth(next);
    },
    [],
  );

  const onResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      try {
        localStorage.setItem(CHAT_WIDTH_KEY, String(widthRef.current));
      } catch {
        // ignore
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    void fetch("/api/chat/health")
      .then((r) => r.json())
      .then((d: { claudeAvailable: boolean }) =>
        setClaudeAvailable(!!d.claudeAvailable),
      )
      .catch(() => setClaudeAvailable(false));
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (
    message: string,
    attachments?: ChatAttachment[],
  ) => {
    await send(message, { mode: "project", projectId }, attachments);
  };

  if (!open) return null;

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 z-50 bg-background border-l border-border shadow-xl flex flex-col"
      role="complementary"
      aria-label="Project AI chat"
      style={{ width: `${width}px` }}
    >
      {/* Drag handle — left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        className="absolute left-0 top-0 bottom-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize select-none touch-none group"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/40 group-hover:bg-primary/60" />
      </div>

      <div className="px-4 py-3 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">AI assistant</h2>
          <p className="text-xs text-muted-foreground truncate max-w-[260px]">
            Editing: {projectName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close chat"
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {claudeAvailable === false ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Plug className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-sm mb-1">Connect Claude CLI</h3>
          <p className="text-xs text-muted-foreground max-w-[260px]">
            Install Claude CLI to use the project assistant.{" "}
            <a
              href="https://docs.anthropic.com/en/docs/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Install guide
            </a>
          </p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                <p className="text-sm mb-1">No messages yet</p>
                <p className="text-xs">
                  Try: &ldquo;Add a 60-frame intro scene with my brand
                  colors&rdquo; or &ldquo;Add a centered title layer to scene
                  2&rdquo;.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                parts={msg.parts}
                agentLabel="Project AI"
                isStreaming={
                  isStreaming &&
                  msg.role === "assistant" &&
                  msg.id === messages[messages.length - 1]?.id
                }
              />
            ))}
            {error && (
              <div className="mx-4 my-2 flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            onStop={stop}
            placeholder="Describe a scene or layer to add… (attach images for design reference)"
            suggestions={[
              "Add a 60-frame intro with a centered title",
              "Make the second scene fade in",
              "Add a logo layer to the first scene",
            ]}
          />
        </>
      )}
    </aside>
  );
}
