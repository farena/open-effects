"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatAttachment, ChatMessage, MessagePart } from "@/types/chat";

export interface UseChatStreamOptions {
  endpoint?: string;
  storageKey?: string | null;
  sessionKey?: string | null;
  /** Called after each assistant turn completes (or aborts).
   *  `usedTools` is true if the assistant invoked at least one tool. */
  onStreamEnd?: (usedTools: boolean) => void;
}

function extractText(parts: MessagePart[]): string {
  return parts
    .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
    .map((p) => p.text)
    .join("");
}

function migrateMessage(raw: unknown): ChatMessage {
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.parts)) {
    return r as unknown as ChatMessage;
  }
  const content = typeof r.content === "string" ? r.content : "";
  return {
    id: (r.id as string) ?? crypto.randomUUID(),
    role: (r.role as "user" | "assistant") ?? "assistant",
    parts: [{ kind: "text", text: content }],
  };
}

function loadMessages(storageKey: string | null | undefined): ChatMessage[] {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.map(migrateMessage);
  } catch {
    return [];
  }
}

function saveMessages(
  storageKey: string | null | undefined,
  messages: ChatMessage[],
) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch {
    // ignore quota errors
  }
}

function loadSessionId(
  sessionKey: string | null | undefined,
): string | null {
  if (!sessionKey) return null;
  return localStorage.getItem(sessionKey);
}

function saveSessionId(sessionKey: string | null | undefined, id: string) {
  if (!sessionKey) return;
  try {
    localStorage.setItem(sessionKey, id);
  } catch {
    // ignore
  }
}

export function useChatStream(opts: UseChatStreamOptions = {}): {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  send: (
    message: string,
    body: Record<string, unknown>,
    attachments?: ChatAttachment[],
  ) => Promise<void>;
  clear: () => void;
  stop: () => void;
} {
  const {
    endpoint = "/api/chat",
    storageKey,
    sessionKey,
    onStreamEnd,
  } = opts;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Always sync the ref to whatever is in storage for the current key —
    // including null. Otherwise a previous project's sessionId leaks into a
    // freshly-opened project (e.g. after Duplicate) and the chat resumes the
    // wrong session, causing edits to land on the original project.
    sessionIdRef.current = loadSessionId(sessionKey);
    setMessages(loadMessages(storageKey));
  }, [storageKey, sessionKey]);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionIdRef.current = null;
    if (storageKey) localStorage.removeItem(storageKey);
    if (sessionKey) localStorage.removeItem(sessionKey);
  }, [storageKey, sessionKey]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (
      message: string,
      extraBody: Record<string, unknown>,
      attachments?: ChatAttachment[],
    ) => {
      if (isStreaming) return;
      setError(null);
      setIsStreaming(true);
      let usedTools = false;

      const userParts: MessagePart[] = [{ kind: "text", text: message }];
      if (attachments) {
        for (const a of attachments) {
          userParts.push({ kind: "image", url: a.path, filename: a.filename });
        }
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: userParts,
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        parts: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId: sessionIdRef.current,
            attachments: attachments && attachments.length > 0 ? attachments : undefined,
            ...extraBody,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || "Failed to connect to AI",
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        const updateAssistant = (
          updater: (parts: MessagePart[]) => MessagePart[],
        ) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, parts: updater(m.parts) } : m,
            ),
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;

              if (data.type === "token" && typeof data.text === "string") {
                const token = data.text as string;
                updateAssistant((parts) => {
                  const last = parts[parts.length - 1];
                  if (last && last.kind === "text") {
                    return [
                      ...parts.slice(0, -1),
                      { kind: "text", text: last.text + token },
                    ];
                  }
                  return [...parts, { kind: "text", text: token }];
                });
              } else if (
                data.type === "result" &&
                typeof data.text === "string"
              ) {
                updateAssistant((parts) => {
                  const nonText = parts.filter((p) => p.kind !== "text");
                  return [...nonText, { kind: "text", text: data.text as string }];
                });
              } else if (data.type === "tool_use") {
                const toolId = data.id as string;
                const name = (data.name as string) ?? "Tool";
                const summary = (data.summary as string) ?? "";
                usedTools = true;
                updateAssistant((parts) => [
                  ...parts,
                  {
                    kind: "tool",
                    toolId,
                    name,
                    summary,
                    status: "running",
                  },
                ]);
              } else if (data.type === "tool_result") {
                const toolId = data.id as string;
                const isError = !!data.isError;
                const resultSummary = (data.summary as string) ?? "";
                updateAssistant((parts) =>
                  parts.map((p) =>
                    p.kind === "tool" && p.toolId === toolId
                      ? {
                          ...p,
                          status: isError ? "error" : "ok",
                          resultSummary,
                        }
                      : p,
                  ),
                );
              }

              if (data.sessionId && typeof data.sessionId === "string") {
                sessionIdRef.current = data.sessionId;
                saveSessionId(sessionKey, data.sessionId);
              }
            } catch {
              // skip unparseable lines
            }
          }
        }

        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (data.sessionId && typeof data.sessionId === "string") {
                sessionIdRef.current = data.sessionId;
                saveSessionId(sessionKey, data.sessionId);
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(msg);
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== assistantId || extractText(m.parts).length > 0,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        setMessages((prev) => {
          saveMessages(storageKey, prev);
          return prev;
        });
        onStreamEnd?.(usedTools);
      }
    },
    [isStreaming, endpoint, storageKey, sessionKey, onStreamEnd],
  );

  return { messages, isStreaming, error, send, clear, stop };
}
