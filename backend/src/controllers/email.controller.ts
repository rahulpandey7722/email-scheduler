import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { emailService } from "../services/email.service";
import { recoverStuckOrUnqueuedEmails } from "../services/recovery.service";
import { getEtherealAccountInfo } from "../config/mailer";

// Zod schema validation for creation payload
export const createEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body content is required"),
  recipients: z.array(z.string().email("Invalid email address format")).min(1, "At least one recipient is required"),
  scheduledFor: z.coerce.date(),
  delayMs: z.number().int().positive().optional(),
  hourlyLimit: z.number().int().positive().optional(),
});

export const emailController = {
  /**
   * Endpoint handler to schedule a new email campaign batch
   */
  async createSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const scheduledEmail = await emailService.createSchedule({
        userId,
        ...req.body,
      });

      return res.status(201).json(scheduledEmail);
    } catch (error: any) {
      // Catch Prisma P2002 Unique Constraint violation (duplicate idempotency key)
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "Duplicate request detected. An identical email schedule already exists.",
        });
      }
      next(error);
    }
  },

  /**
   * Retrieves pending/queued/rescheduled emails for dashboard
   */
  async getScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const emails = await emailService.getScheduledEmails(req.user!.id);
      return res.json(emails);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves delivered/sent emails archive
   */
  async getSent(req: Request, res: Response, next: NextFunction) {
    try {
      const emails = await emailService.getSentEmails(req.user!.id);
      return res.json(emails);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves full email history across all statuses
   */
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const emails = await emailService.getAllEmails(req.user!.id);
      return res.json(emails);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Triggers queue recovery reconciliation for interrupted or queued emails after server restart/crash
   */
  async triggerRecovery(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await recoverStuckOrUnqueuedEmails();
      return res.json({
        message: "Email queue crash recovery completed successfully",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Returns current Ethereal Email sandbox test credentials and webmail URL
   */
  async getEtherealInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      const etherealAccount = await getEtherealAccountInfo();
      if (!etherealAccount) {
        return res.json({
          enabled: false,
          message: "Standard SMTP configuration active",
        });
      }

      return res.json({
        enabled: true,
        user: etherealAccount.user,
        pass: etherealAccount.pass,
        webmail: etherealAccount.web || "https://ethereal.email",
      });
    } catch (error) {
      next(error);
    }
  },
};
