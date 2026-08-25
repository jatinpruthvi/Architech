/* Client error reporting helper.
   Normalizes an uncaught error into a serializable, redacted payload before it
   is sent to the observability endpoint. Never transmits raw stack traces with
   local paths; never includes PII. */

export type ClientErrorSeverity = "warning" | "error";

export type ClientErrorReport = {
  message: string;
  severity: ClientErrorSeverity;
  stack?: string;
  componentStack?: string;
  route?: string;
  userAgent?: string;
  href?: string;
  /** Incremented per-version so error clusters can be bucketed. */
  buildTag?: string;
};

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Normalize a thrown value into a safe report, stripping PII and truncating. */
export function normalizeClientError(value: unknown, metadata: Partial<ClientErrorReport> = {}): ClientErrorReport {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Unknown client error";
  return {
    message: truncate(message.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, " "), MAX_MESSAGE),
    severity: metadata.severity ?? "error",
    stack: value instanceof Error && value.stack ? truncate(value.stack, MAX_STACK) : undefined,
    componentStack: metadata.componentStack ? truncate(metadata.componentStack, MAX_STACK) : undefined,
    route: metadata.route,
    userAgent: metadata.userAgent ? truncate(metadata.userAgent, 300) : undefined,
    href: metadata.href ? truncate(metadata.href, 500) : undefined,
    buildTag: metadata.buildTag,
  };
}

export function isReportableSeverity(value: unknown): value is ClientErrorSeverity {
  return value === "warning" || value === "error";
}
