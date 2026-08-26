import IORedis from "ioredis";
import { env } from "./env";

let isRedisConnected = false;

// BullMQ requires maxRetriesPerRequest to be set to null on the Redis connection.
export const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true, // Don't crash immediately on boot if Redis is offline
  retryStrategy(times) {
    // Retry periodically without spamming logs
    return Math.min(times * 1000, 5000);
  },
});

connection.on("connect", () => {
  isRedisConnected = true;
});

connection.on("ready", () => {
  isRedisConnected = true;
});

connection.on("error", (error: Error) => {
  isRedisConnected = false;
  // Silent warning for graceful fallback when Docker / Redis is not running
});

export function getIsRedisConnected(): boolean {
  return isRedisConnected;
}

// Attempt initial non-blocking connection
connection.connect().catch(() => {
  isRedisConnected = false;
});
