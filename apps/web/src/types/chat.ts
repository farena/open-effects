export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; filename?: string }
  | {
      kind: "tool";
      toolId: string;
      name: string;
      summary: string;
      status: "running" | "ok" | "error";
      resultSummary?: string;
    };

export interface ChatAttachment {
  path: string;
  filename?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export type ChatMode = "business-context" | "project";
