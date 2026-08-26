import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Express Request Body Validation Middleware using Zod Schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parseResult = schema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error in request parameters",
        details: parseResult.error.flatten(),
      });
    }

    // Replace request body with validated and parsed data object
    req.body = parseResult.data;
    next();
  };
};
