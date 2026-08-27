import { env } from "./config/env";
import { app } from "./app";
import { logger } from "./utils/logger";
import { recoverStuckOrUnqueuedEmails } from "./services/recovery.service";

// Main Express API Server HTTP Listener Entrypoint
app.listen(env.PORT, async () => {
  logger.info(`[API Server] Express server running on port ${env.PORT} in ${env.NODE_ENV} mode`);

  // Run queue recovery reconciliation on boot to handle any past crash or overload state
  try {
    await recoverStuckOrUnqueuedEmails();
  } catch (err: any) {
    logger.warn({ error: err.message }, "Server boot queue recovery check failed");
  }
});
