import nodemailer from "nodemailer";
import { getActiveTransporter } from "../config/mailer";
import { logger } from "../utils/logger";

interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
}

export interface SendEmailResult {
  dispatchResult: any;
  previewUrl: string | false | null;
}

/**
 * Mail Dispatcher Service wrapping Nodemailer
 */
export async function sendEmail({ to, subject, body }: SendEmailOptions): Promise<SendEmailResult> {
  const mailDetails = {
    from: '"Email Scheduler Service" <no-reply@scheduler.app>',
    to: to.join(", "),
    subject,
    text: body,
    html: `<div style="font-family: system-ui, -apple-system, sans-serif; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; background-color: #ffffff; color: #1e293b;">
      <h2 style="color: #4f46e5; margin-top: 0;">${subject}</h2>
      <div style="font-size: 15px; line-height: 1.6; color: #334155;">
        ${body.replace(/\n/g, "<br/>")}
      </div>
      <hr style="margin-top: 24px; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #94a3b8;">Sent via Email Scheduler Service</p>
    </div>`,
  };

  const activeTransporter = await getActiveTransporter();
  const dispatchResult = await activeTransporter.sendMail(mailDetails);

  // If using Ethereal sandbox SMTP, log and return the live preview link
  const previewUrl = nodemailer.getTestMessageUrl(dispatchResult);
  if (previewUrl) {
    logger.info({ previewUrl }, "[Ethereal Email Sandbox Live Preview URL]");
  }

  return {
    dispatchResult,
    previewUrl: previewUrl || null,
  };
}
