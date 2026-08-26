import { Worker, Job } from "bullmq";
import { connection } from "../config/redis";
import { EMAIL_DISPATCH_QUEUE } from "../queues/queue.constants";
import { DispatchEmailJobPayload } from "../types/job.types";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { rateLimiter } from "../services/rateLimiter.service";
import { checkRedisDuplicate, setRedisDispatched } from "../services/idempotency.service";
import { sendEmail } from "../services/mail.service";
import { rescheduleEmailJob } from "../queues/email.queue";
import { logger } from "../utils/logger";

/**
 * Core job processor called by BullMQ or in-memory fallback when an email timer triggers
 */
export async function processEmailDispatchJob(job: Job<DispatchEmailJobPayload>) {
  const { emailId } = job.data;
  logger.info({ emailId, jobId: job.id }, "Processing email dispatch job");

  // Step 1: Re-fetch fresh email record from database source of truth
  const emailRecord = await prisma.email.findUnique({
    where: { id: emailId },
    include: { recipients: true },
  });

  if (!emailRecord) {
    logger.warn({ emailId }, "Email record deleted from DB, skipping job execution");
    return;
  }

  // Step 2: Idempotency safety short-circuit — verify email hasn't already sent
  if (emailRecord.status === "SENT") {
    logger.info({ emailId }, "Email already marked SENT in Postgres/SQLite, skipping redundant run");
    return;
  }

  // Step 3: Fast duplicate check
  const isDuplicate = await checkRedisDuplicate(emailRecord.idempotencyKey);
  if (isDuplicate) {
    logger.info({ emailId }, "Duplicate dispatch detected, aborting");
    return;
  }

  // Step 4: Hourly user rate limit validation
  const withinLimit = await rateLimiter.consume(emailRecord.userId, emailRecord.hourlyLimit);
  if (!withinLimit) {
    const delayUntilNextWindow = rateLimiter.getMsUntilNextWindow();
    logger.info(
      { emailId, userId: emailRecord.userId, delayMs: delayUntilNextWindow },
      "Hourly rate limit exceeded — rescheduling job to next hour window"
    );

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "RESCHEDULED" },
    });

    await rescheduleEmailJob(emailId, delayUntilNextWindow);
    return;
  }

  // Step 5: Mark status as SENDING before calling SMTP
  await prisma.email.update({
    where: { id: emailId },
    data: { status: "SENDING" },
  });

  // Step 6: Dispatch email via SMTP
  try {
    const recipientAddresses = emailRecord.recipients.map((r) => r.address);

    await sendEmail({
      to: recipientAddresses,
      subject: emailRecord.subject,
      body: emailRecord.body,
    });

    // Step 7: Record dispatched state in idempotency cache
    await setRedisDispatched(emailRecord.idempotencyKey);

    // Step 8: Update status to SENT
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    logger.info({ emailId }, "Email successfully delivered and recorded");
  } catch (sendErr: any) {
    const errorMessage = sendErr.message ? sendErr.message.substring(0, 500) : "Unknown transport error";
    logger.error({ emailId, error: errorMessage }, "SMTP dispatch failure");

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: errorMessage,
      },
    });

    throw sendErr;
  }

  // Step 9: Minimum delay throttle to smooth delivery rate across worker pool
  if (env.MIN_DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, env.MIN_DELAY_MS));
  }
}

/**
 * BullMQ Worker instance handling concurrent execution slots
 */
export const emailWorker = new Worker<DispatchEmailJobPayload>(
  EMAIL_DISPATCH_QUEUE,
  processEmailDispatchJob,
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "BullMQ email job completed successfully");
});

emailWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "BullMQ email job failed");
});
