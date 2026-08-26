import { connection, getIsRedisConnected } from "../config/redis";

/**
 * Hourly Rate Limiter Service
 * Uses Redis INCR when available, falls back to in-memory Map if Redis is offline.
 */
class HourlyRateLimiter {
  private inMemoryBuckets = new Map<string, number>();

  private generateKey(userId: string, date = new Date()): string {
    const timestampBucket = date.toISOString().substring(0, 13); // Format: "YYYY-MM-DDTHH"
    return `ratelimit:${userId}:${timestampBucket}`;
  }

  /**
   * Attempts to consume 1 email token from the user's hourly bucket.
   */
  async consume(userId: string, hourlyQuota: number): Promise<boolean> {
    const key = this.generateKey(userId);

    if (getIsRedisConnected()) {
      try {
        const currentCount = await connection.incr(key);
        if (currentCount === 1) {
          await connection.expire(key, 3600);
        }
        return currentCount <= hourlyQuota;
      } catch (err) {
        // Fallback to in-memory check
      }
    }

    // In-memory fallback
    const count = (this.inMemoryBuckets.get(key) || 0) + 1;
    this.inMemoryBuckets.set(key, count);
    return count <= hourlyQuota;
  }

  getMsUntilNextWindow(): number {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);

    return nextHour.getTime() - now.getTime();
  }
}

export const rateLimiter = new HourlyRateLimiter();
