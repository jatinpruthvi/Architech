import pino from "pino";

export const logger = pino({
  name: "architech-web",
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["req.headers.authorization", "token", "password", "phone", "phoneMasked", "email"],
    censor: "[redacted]",
  },
  base: {
    service: "architech-web",
    environment: process.env.APP_ENV ?? process.env.NODE_ENV,
  },
});

export type LogEvent = {
  event: string;
  route?: string;
  status?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export function logInfo(event: LogEvent) {
  logger.info(event, event.event);
}

export function logError(event: LogEvent & { error?: unknown }) {
  logger.error({ ...event, error: event.error instanceof Error ? { message: event.error.message, stack: event.error.stack } : event.error }, event.event);
}
