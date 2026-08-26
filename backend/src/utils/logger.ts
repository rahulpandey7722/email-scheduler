import pino from "pino";
import { env } from "../config/env";

// Logger utility wrapping Pino for structured JSON logging
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  timestamp: pino.stdTimeFunctions.isoTime,
});
