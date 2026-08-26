import { EmailStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export const emailRepository = {
  /**
   * Create new Email record with nested recipients
   */
  async createEmail(data: Prisma.EmailCreateInput) {
    return prisma.email.create({
      data,
      include: { recipients: true },
    });
  },

  /**
   * Query emails for a specific user filtered by status enum array
   */
  async findByUserAndStatuses(userId: string, statuses: EmailStatus[]) {
    return prisma.email.findMany({
      where: {
        userId,
        status: { in: statuses },
      },
      include: { recipients: true },
      orderBy: { scheduledFor: "asc" },
    });
  },

  /**
   * Fetch single Email by ID including recipients
   */
  async findById(id: string) {
    return prisma.email.findUnique({
      where: { id },
      include: { recipients: true },
    });
  },

  /**
   * Update status or error details on Email
   */
  async updateStatus(id: string, data: Prisma.EmailUpdateInput) {
    return prisma.email.update({
      where: { id },
      data,
    });
  },
};
