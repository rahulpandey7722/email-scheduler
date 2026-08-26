import "dotenv/config";
import { z } from "zod";

// Schema validation for application environment parameters.
// Verifying configuration at boot prevents runtime failures due to missing variables.
const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Database Connection URL (Postgres)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis Host and Port settings for BullMQ & rate-limiting
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  // Nodemailer SMTP Credentials
  SMTP_HOST: z.string().default("smtp.ethereal.email"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default("test_user"),
  SMTP_PASS: z.string().default("test_pass"),

  // OAuth & JWT Auth settings
  GOOGLE_CLIENT_ID: z.string().default("google_client_id_placeholder"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long"),

  // Delivery pacing defaults
  MIN_DELAY_MS: z.coerce.number().default(2000),
  DEFAULT_HOURLY_LIMIT: z.coerce.number().default(200),
  WORKER_CONCURRENCY: z.coerce.number().default(10),
});

// Parse process.env strictly; throws detailed error if validation fails
export const env = environmentSchema.parse(process.env);
