export type DbErrorKind =
  | "connection-refused"
  | "auth-failed"
  | "unknown-database"
  | "timeout"
  | "unknown";

export type ParsedDbError = {
  kind: DbErrorKind;
  userMessage: string;
};

export function parseDbError(err: unknown): ParsedDbError | null {
  if (!err || typeof err !== "object") return null;
  const raw = (err as { message?: unknown }).message;
  if (typeof raw !== "string") return null;
  const message = raw.toLowerCase();

  const looksUnreachable =
    message.includes("econnrefused") ||
    message.includes("can't reach database server") ||
    message.includes("connection refused") ||
    (message.includes("pool timeout") && /active=0\s+idle=0/.test(message));

  if (looksUnreachable) {
    return {
      kind: "connection-refused",
      userMessage:
        "Cannot reach the database. Make sure MariaDB is running and DATABASE_URL is correct.",
    };
  }
  if (message.includes("access denied")) {
    return {
      kind: "auth-failed",
      userMessage:
        "Database authentication failed. Check the DATABASE_URL credentials.",
    };
  }
  if (message.includes("unknown database")) {
    return {
      kind: "unknown-database",
      userMessage:
        "The configured database does not exist. Run migrations or create it first.",
    };
  }
  if (message.includes("pool timeout") || message.includes("etimedout")) {
    return {
      kind: "timeout",
      userMessage:
        "Database is not responding within the timeout. The server may be overloaded or unreachable.",
    };
  }
  return null;
}

export function dbErrorMessage(err: unknown, fallback: string): string {
  return parseDbError(err)?.userMessage ?? fallback;
}
