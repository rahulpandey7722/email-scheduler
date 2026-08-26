import nodemailer from "nodemailer";
import { transporter } from "../config/mailer";
import { logger } from "../utils/logger";

interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
}

/**
 * Mail Dispatcher Service wrapping Nodemailer
 */
export async function sendEmail({ to, subject, body }: SendEmailOptions) {
  const mailDetails = {
    from: '"Email Scheduler Service" <no-reply@scheduler.app>',
    to: to.join(", "),
    subject,
    text: body,
    html: `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
      <h2>${subject}</h2>
      <p>${body.replace(/\n/g, "<br/>")}</p>
    </div>`,
  };

  const dispatchResult = await transporter.sendMail(mailDetails);

  // If using Ethereal sandbox SMTP, log the live preview link
  const previewUrl = nodemailer.getTestMessageUrl(dispatchResult);
  if (previewUrl) {
    logger.info({ previewUrl }, "[Ethereal Email Preview URL]");
  }

  return dispatchResult;
}
