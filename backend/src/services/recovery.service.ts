import { prisma } from "../config/db";
import { scheduleEmailJob } from "../queues/email.queue";
import { logger } from "../utils/logger";

export interface RecoveryResult {
  totalScanned: number;
  resetSendingCount: number;
  requeuedCount: number;
  recoveredEmailIds: string[];
}

/**
 * Crash / Overload Recovery Service
 * Re-enqueues emails that were left in PENDING, QUEUED, SENDING, or RESCHEDULED state
 * when the server or worker crashed, restarted, or experienced heavy load.
 */
export async function recoverStuckOrUnqueuedEmails(): Promise<RecoveryResult> {
  logger.info("Initiating server crash / overload email queue recovery scan...");

  try {
    // 1. Fetch all emails in non-terminal states
    const activeEmails = await prisma.email.findMany({
      where: {
        status: {
          in: ["PENDING", "QUEUED", "SENDING", "RESCHEDULED"],
        },
      },
    });

    if (activeEmails.length === 0) {
      logger.info("Recovery scan complete: No interrupted or queued emails pending execution.");
      return { totalScanned: 0, resetSendingCount: 0, requeuedCount: 0, recoveredEmailIds: [] };
    }

    logger.info({ count: activeEmails.length }, `Found ${activeEmails.length} active/interrupted email records to reconcile`);

    let resetSendingCount = 0;
    let requeuedCount = 0;
    const recoveredEmailIds: string[] = [];

    for (const email of activeEmails) {
      // If email was stuck in 'SENDING' state when server crashed, revert it to QUEUED
      if (email.status === "SENDING") {
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "QUEUED" },
        });
        resetSendingCount++;
      }

      // Re-enqueue into BullMQ (or in-memory scheduler)
      const jobId = await scheduleEmailJob(email.id, new Date(email.scheduledFor));
      if (jobId) {
        await prisma.email.update({
          where: { id: email.id },
          data: { bullJobId: jobId },
        });
      }

      requeuedCount++;
      recoveredEmailIds.push(email.id);
    }

    logger.info(
      { totalScanned: activeEmails.length, resetSendingCount, requeuedCount },
      "Queue recovery completed successfully: All pending/stuck emails re-enqueued"
    );

    return {
      totalScanned: activeEmails.length,
      resetSendingCount,
      requeuedCount,
      recoveredEmailIds,
    };
  } catch (err: any) {
    logger.error({ error: err.message }, "Error during email queue crash recovery execution");
    return {
      totalScanned: 0,
      resetSendingCount: 0,
      requeuedCount: 0,
      recoveredEmailIds: [],
    };
  }
}
