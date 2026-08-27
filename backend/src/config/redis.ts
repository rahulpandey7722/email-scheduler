import IORedis from "ioredis";
import { env } from "./env";

let isRedisConnected = false;

// BullMQ requires maxRetriesPerRequest to be set to null on the Redis connection.
export const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false, // Prevent commands from buffering indefinitely when Redis is offline
  lazyConnect: true, // Don't crash immediately on boot if Redis is offline
  retryStrategy(times) {
    // Retry periodically without spamming logs
    return Math.min(times * 1000, 5000);
  },
});

connection.on("connect", () => {
  isRedisConnected = connection.status === "ready";
});

connection.on("ready", () => {
  isRedisConnected = true;
});

connection.on("error", (_error: Error) => {
  isRedisConnected = false;
  // Silent warning for graceful fallback when Docker / Redis is not running
});

export function getIsRedisConnected(): boolean {
  return isRedisConnected && connection.status === "ready";
}

// Attempt initial non-blocking connection
connection.connect().catch(() => {
  isRedisConnected = false;
});
