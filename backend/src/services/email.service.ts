import { emailRepository } from "../repositories/email.repository";
import { generateIdempotencyKey } from "./idempotency.service";
import { scheduleEmailJob } from "../queues/email.queue";
import { env } from "../config/env";

export interface CreateEmailScheduleDTO {
  userId: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledFor: Date;
  delayMs?: number;
  hourlyLimit?: number;
}

export const emailService = {
  /**
   * Orchestrates schedule creation:
   * 1. Generates SHA-256 idempotency key
   * 2. Saves schedule record to PostgreSQL (DB unique constraint enforces idempotency)
   * 3. Adds delayed job to BullMQ Redis queue with `jobId = email.id`
   */
  async createSchedule(input: CreateEmailScheduleDTO) {
    const idempotencyKey = generateIdempotencyKey({
      userId: input.userId,
      subject: input.subject,
      scheduledFor: input.scheduledFor,
      recipients: input.recipients,
    });

    // Save schedule in PostgreSQL database
    const emailRecord = await emailRepository.createEmail({
      user: { connect: { id: input.userId } },
      subject: input.subject,
      body: input.body,
      scheduledFor: input.scheduledFor,
      delayMs: input.delayMs ?? env.MIN_DELAY_MS,
      hourlyLimit: input.hourlyLimit ?? env.DEFAULT_HOURLY_LIMIT,
      idempotencyKey,
      status: "PENDING",
      recipients: {
        create: input.recipients.map((addr) => ({ address: addr })),
      },
    });

    // Enqueue delayed job into BullMQ
    const bullJobId = await scheduleEmailJob(emailRecord.id, input.scheduledFor);

    // Update email record with BullMQ job ID reference
    await emailRepository.updateStatus(emailRecord.id, {
      bullJobId: bullJobId ?? emailRecord.id,
      status: "QUEUED",
    });

    return emailRepository.findById(emailRecord.id);
  },

  /**
   * Retrieve list of pending/queued/rescheduled emails for dashboard view
   */
  async getScheduledEmails(userId: string) {
    return emailRepository.findByUserAndStatuses(userId, ["PENDING", "QUEUED", "RESCHEDULED"]);
  },

  /**
   * Retrieve list of sent emails for user archive view
   */
  async getSentEmails(userId: string) {
    return emailRepository.findByUserAndStatuses(userId, ["SENT"]);
  },
};
