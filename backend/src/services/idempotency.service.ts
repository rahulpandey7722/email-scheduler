import crypto from "crypto";
import { connection, getIsRedisConnected } from "../config/redis";

const IDEMPOTENCY_TTL_SECONDS = 86400;
const inMemoryDispatched = new Set<string>();

/**
 * Creates a unique SHA-256 idempotency key hash derived from email request parameters.
 */
export function generateIdempotencyKey(params: {
  userId: string;
  subject: string;
  scheduledFor: Date;
  recipients: string[];
}): string {
  const normalizedRecipients = [...params.recipients].sort().join(",");
  const rawString = `${params.userId}|${params.subject}|${params.scheduledFor.toISOString()}|${normalizedRecipients}`;

  return crypto.createHash("sha256").update(rawString).digest("hex");
}

/**
 * Fast pre-check to detect if an email has already been dispatched.
 */
export async function checkRedisDuplicate(idempotencyKey: string): Promise<boolean> {
  if (getIsRedisConnected()) {
    try {
      const marker = await connection.get(`dispatched:${idempotencyKey}`);
      return marker !== null;
    } catch (err) {
      // Fallback
    }
  }

  return inMemoryDispatched.has(idempotencyKey);
}

/**
 * Marks an idempotency key as dispatched after successful email send.
 */
export async function setRedisDispatched(idempotencyKey: string): Promise<void> {
  inMemoryDispatched.add(idempotencyKey);

  if (getIsRedisConnected()) {
    try {
      await connection.set(`dispatched:${idempotencyKey}`, "1", "EX", IDEMPOTENCY_TTL_SECONDS);
    } catch (err) {
      // Fallback
    }
  }
}
