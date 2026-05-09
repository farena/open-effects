"use client";

import { cn } from "@/lib/utils";
import { Bot, User, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { MessagePart } from "@/types/chat";

interface ChatMessageProps {
  role: "user" | "assistant";
  parts: MessagePart[];
  isStreaming?: boolean;
  agentLabel?: string;
}

export function ChatMessage({
  role,
  parts,
  isStreaming,
  agentLabel = "Open Effects AI",
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        role === "user" ? "bg-transparent" : "bg-muted/50",
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          role === "user"
            ? "bg-foreground text-background"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {role === "user" ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          {role === "user" ? "You" : agentLabel}
        </div>
        <div className="text-sm leading-relaxed break-words">
          {(() => {
            const nodes: React.ReactNode[] = [];
            let imgGroup: { url: string; filename?: string }[] = [];
            const flushImages = () => {
              if (imgGroup.length === 0) return;
              const groupKey = `imgs-${nodes.length}`;
              const items = imgGroup;
              nodes.push(
                <div
                  key={groupKey}
                  className="grid grid-cols-4 gap-1 mt-1.5 justify-items-start"
                >
                  {items.map((img, idx) => (
                    <a
                      key={`${groupKey}-${idx}`}
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={img.filename}
                      className="block w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.filename ?? "attachment"}
                        className="aspect-square w-full object-cover rounded-md border border-border"
                      />
                    </a>
                  ))}
                </div>,
              );
              imgGroup = [];
            };
            parts.forEach((part, i) => {
              if (part.kind === "image") {
                imgGroup.push({ url: part.url, filename: part.filename });
                return;
              }
              flushImages();
              if (part.kind === "text") {
                nodes.push(
                  <span key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </span>,
                );
                return;
              }
              nodes.push(
                <div key={i} className="my-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 border border-border/60 px-2 py-1 text-[11px] font-mono text-muted-foreground">
                    {part.status === "running" && (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    )}
                    {part.status === "ok" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    )}
                    {part.status === "error" && (
                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                    <span className="font-semibold">{part.name}</span>
                    <span
                      className="truncate max-w-[280px]"
                      title={part.summary}
                    >
                      {part.summary}
                    </span>
                  </div>
                  {part.status === "error" && part.resultSummary && (
                    <div className="mt-0.5 text-[10px] text-destructive font-mono pl-1">
                      {part.resultSummary}
                    </div>
                  )}
                </div>,
              );
            });
            flushImages();
            return nodes;
          })()}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-foreground/70 ml-0.5 align-text-bottom animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
