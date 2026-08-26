import { env } from "./config/env";
import { app } from "./app";
import { logger } from "./utils/logger";

// Main Express API Server HTTP Listener Entrypoint
app.listen(env.PORT, () => {
  logger.info(`[API Server] Express server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
