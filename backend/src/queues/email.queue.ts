import { Queue } from "bullmq";
import { connection, getIsRedisConnected } from "../config/redis";
import { EMAIL_DISPATCH_QUEUE, SEND_EMAIL_TASK } from "./queue.constants";
import { DispatchEmailJobPayload } from "../types/job.types";
import { processEmailDispatchJob } from "../workers/email.worker";
import { logger } from "../utils/logger";

// BullMQ Queue instance backed by Redis sorted sets.
export const emailQueue = new Queue<DispatchEmailJobPayload>(EMAIL_DISPATCH_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  },
});

/**
 * Schedule an email job. Uses BullMQ when Redis is available, or an in-memory timer fallback when Redis is offline.
 */
export async function scheduleEmailJob(emailId: string, scheduledFor: Date) {
  const delayTime = Math.max(0, scheduledFor.getTime() - Date.now());

  if (getIsRedisConnected()) {
    try {
      // 2000ms strict timeout safeguard against hanging queue connections
      const enqueuePromise = emailQueue.add(
        SEND_EMAIL_TASK,
        { emailId },
        {
          delay: delayTime,
          jobId: emailId,
        }
      );

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("BullMQ enqueue operation timed out")), 2000)
      );

      const job = await Promise.race([enqueuePromise, timeoutPromise]);
      return job.id;
    } catch (err: any) {
      logger.warn({ emailId, error: err.message }, "Redis BullMQ queue error/timeout, falling back to in-memory scheduler");
    }
  }

  // In-memory scheduler fallback for zero-dependency execution
  logger.info({ emailId, delayMs: delayTime }, "Scheduling job via in-memory timer fallback");
  setTimeout(async () => {
    try {
      const mockJob: any = { id: emailId, data: { emailId } };
      await processEmailDispatchJob(mockJob);
    } catch (err: any) {
      logger.error({ emailId, error: err.message }, "In-memory job processing failed");
    }
  }, delayTime);

  return `mem-${emailId}`;
}

/**
 * Reschedule an email job when rate limits are exceeded.
 */
export async function rescheduleEmailJob(emailId: string, extraDelayMs: number) {
  if (getIsRedisConnected()) {
    try {
      const existingJob = await emailQueue.getJob(emailId);
      if (existingJob) {
        await existingJob.remove();
      }
      return emailQueue.add(
        SEND_EMAIL_TASK,
        { emailId },
        {
          delay: extraDelayMs,
          jobId: `${emailId}-retry-${Date.now()}`,
        }
      );
    } catch (err) {
      // Fallback
    }
  }

  setTimeout(async () => {
    try {
      const mockJob: any = { id: emailId, data: { emailId } };
      await processEmailDispatchJob(mockJob);
    } catch (err: any) {
      logger.error({ emailId, error: err.message }, "Rescheduled in-memory job processing failed");
    }
  }, extraDelayMs);

  return `mem-resched-${emailId}`;
}
