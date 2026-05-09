import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { getClaudePath, isClaudeAvailable } from "@/lib/claude-path";
import { buildBusinessContextSystemPrompt } from "@/lib/prompts/business-context-system-prompt";
import { buildProjectSystemPrompt } from "@/lib/prompts/project-system-prompt";
import { getBusinessContext } from "@/lib/business-context";
import { toProjectJson } from "@/lib/persistence/toProjectJson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ChatBody = {
  message?: string;
  sessionId?: string | null;
  mode?: "business-context" | "project";
  projectId?: string;
};

export async function POST(request: NextRequest) {
  if (!isClaudeAvailable()) {
    return NextResponse.json(
      {
        error:
          "Claude CLI not found. Install from https://docs.anthropic.com/en/docs/claude-code or set CLAUDE_CLI_PATH in .env.local",
      },
      { status: 503 },
    );
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, sessionId, mode, projectId } = body;

  if (
    !message ||
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 10000
  ) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  let systemPrompt: string;
  let agentName: string;

  if (mode === "business-context") {
    const ctx = await getBusinessContext();
    systemPrompt = buildBusinessContextSystemPrompt(ctx);
    agentName = "business-context-chat";
  } else if (mode === "project") {
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required for mode 'project'" },
        { status: 400 },
      );
    }
    let project;
    try {
      project = await toProjectJson(projectId);
    } catch {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const ctx = await getBusinessContext();
    systemPrompt = buildProjectSystemPrompt({
      project,
      businessContext: ctx,
    });
    agentName = `project-chat-${projectId.slice(0, 8)}`;
  } else {
    return NextResponse.json(
      { error: "mode must be 'business-context' or 'project'" },
      { status: 400 },
    );
  }

  const claudePath = getClaudePath();
  const abortController = new AbortController();

  const args = [
    "-p",
    message,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--append-system-prompt",
    systemPrompt,
    "--allowedTools",
    "Bash",
    "--allowedTools",
    "WebFetch",
    "--allowedTools",
    "Read",
    "--max-budget-usd",
    "1.00",
    "--name",
    agentName,
  ];

  if (sessionId) {
    args.push("--resume", sessionId);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let childProcess: ReturnType<typeof spawn>;

      try {
        childProcess = spawn(claudePath, args, {
          cwd: process.cwd(),
          signal: abortController.signal,
          stdio: ["pipe", "pipe", "pipe"],
        });
        childProcess.stdin?.end();
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        console.error("[chat] failed to spawn Claude CLI", {
          claudePath,
          platform: process.platform,
          code: e?.code,
          message: e?.message,
        });
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: "Failed to start Claude CLI",
              code: e?.code,
              path: claudePath,
              message: e?.message,
            })}\n\n`,
          ),
        );
        controller.close();
        return;
      }

      let buffer = "";
      let resolvedSessionId = sessionId ?? "";

      childProcess.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            handleEvent(event, controller, encoder, (id) => {
              resolvedSessionId = id;
            });
          } catch {
            // skip unparseable lines
          }
        }
      });

      let stderrBuf = "";
      const STDERR_CAP = 8192;
      childProcess.stderr?.on("data", (chunk: Buffer) => {
        if (stderrBuf.length < STDERR_CAP) {
          stderrBuf = (stderrBuf + chunk.toString()).slice(-STDERR_CAP);
        }
      });

      const timeout = setTimeout(() => {
        childProcess.kill();
      }, 480_000);

      childProcess.on("error", (err) => {
        clearTimeout(timeout);
        const e = err as NodeJS.ErrnoException;
        console.error("[chat] Claude subprocess error", {
          claudePath,
          platform: process.platform,
          code: e?.code,
          syscall: e?.syscall,
          path: e?.path,
          message: e?.message,
          stderr: stderrBuf,
        });
        try {
          childProcess.kill();
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error: err.message,
                code: e?.code,
                syscall: e?.syscall,
                path: e?.path,
                stderr: stderrBuf || undefined,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          // stream already closed
        }
      });

      childProcess.on("exit", (code) => {
        clearTimeout(timeout);
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            handleEvent(event, controller, encoder, (id) => {
              resolvedSessionId = id;
            });
          } catch {
            // skip
          }
        }

        if (code && code !== 0) {
          console.error("[chat] Claude subprocess exited non-zero", {
            claudePath,
            platform: process.platform,
            exitCode: code,
            stderr: stderrBuf,
          });
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  error: `Claude CLI exited with code ${code}`,
                  exitCode: code,
                  stderr: stderrBuf || undefined,
                })}\n\n`,
              ),
            );
          } catch {
            // stream already closed
          }
        }

        try {
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                sessionId: resolvedSessionId,
                exitCode: code,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          // stream already closed
        }
      });
    },

    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function handleEvent(
  event: Record<string, unknown>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  onSessionId: (id: string) => void,
) {
  if (
    event.type === "system" &&
    event.subtype === "init" &&
    event.session_id
  ) {
    onSessionId(event.session_id as string);
    return;
  }

  if (event.type === "assistant" && event.message) {
    const msg = event.message as Record<string, unknown>;
    if (msg.type === "message" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "token", text: b.text })}\n\n`,
            ),
          );
        } else if (b.type === "tool_use") {
          const id = b.id as string | undefined;
          const name = b.name as string | undefined;
          const input = (b.input ?? {}) as Record<string, unknown>;
          let summary: string;
          if (name === "Bash" && typeof input.command === "string") {
            summary =
              input.command.length > 120
                ? input.command.slice(0, 120) + "…"
                : input.command;
          } else if (name === "Read" && typeof input.file_path === "string") {
            summary = input.file_path;
          } else if (name === "WebFetch" && typeof input.url === "string") {
            summary =
              input.url.length > 80
                ? input.url.slice(0, 80) + "…"
                : input.url;
          } else {
            summary = JSON.stringify(input).slice(0, 100);
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "tool_use", id, name, summary })}\n\n`,
            ),
          );
        }
      }
    }
    return;
  }

  if (event.type === "user" && event.message) {
    const msg = event.message as Record<string, unknown>;
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const b = block as Record<string, unknown>;
        if (b.type === "tool_result") {
          const toolUseId = b.tool_use_id as string | undefined;
          const isError = !!b.is_error;
          const rawContent = b.content;
          let text = "";
          if (typeof rawContent === "string") {
            text = rawContent;
          } else if (Array.isArray(rawContent)) {
            text = rawContent
              .map((c: unknown) => {
                const cb = c as Record<string, unknown>;
                return cb.type === "text" && typeof cb.text === "string"
                  ? cb.text
                  : "";
              })
              .join("");
          }
          const limit = isError ? 120 : 80;
          const summary =
            text.length > limit ? text.slice(0, limit) + "…" : text;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "tool_result",
                id: toolUseId,
                isError,
                summary,
              })}\n\n`,
            ),
          );
        }
      }
    }
    return;
  }

  if (event.type === "result") {
    if (event.session_id) {
      onSessionId(event.session_id as string);
    }
    if (typeof event.result === "string" && event.result) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "result", text: event.result })}\n\n`,
        ),
      );
    }
    return;
  }
}
