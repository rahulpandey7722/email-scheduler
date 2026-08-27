import "../config/env";
import { emailWorker } from "./email.worker";
import { recoverStuckOrUnqueuedEmails } from "../services/recovery.service";
import { logger } from "../utils/logger";

// Standalone Worker Process Entrypoint
logger.info("Initializing background BullMQ Email Worker Process...");

// Execute crash recovery scan on worker process boot
recoverStuckOrUnqueuedEmails().catch((err) => {
  logger.warn({ error: err.message }, "Worker boot queue recovery scan failed");
});

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received. Gracefully stopping BullMQ worker...");
  try {
    await emailWorker.close();
    logger.info("Worker stopped cleanly. Exiting process.");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during worker graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
