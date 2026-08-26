import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Global Express Centralized Error Handler Middleware
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled express application exception");

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal server processing error";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
