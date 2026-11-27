import pino, { type Logger, type LoggerOptions } from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "*.password",
  "*.passwordHash",
  "*.secret",
  "*.token",
  "*.apiKey",
  "*.sessionSecret",
  "SESSION_SECRET",
  "GEMINI_API_KEY",
];

export function createLogger(level: string = "info"): Logger {
  const options: LoggerOptions = {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    base: {
      service: "resolveai-api",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return pino(options);
}
