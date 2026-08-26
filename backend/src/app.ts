import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import authRouter from "./routes/auth.routes";
import emailRouter from "./routes/email.routes";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

export const app = express();

// Middleware pipeline setup
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Health Check Endpoint for container orchestrators
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/emails", emailRouter);

// Centralized error handling middleware
app.use(errorHandler);
