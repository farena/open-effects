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

export function ProjectChat({
  projectId,
  projectName,
  open,
  onClose,
}: ProjectChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);

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
      className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-[90vw] bg-background border-l border-border shadow-xl flex flex-col"
      role="complementary"
      aria-label="Project AI chat"
    >
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
