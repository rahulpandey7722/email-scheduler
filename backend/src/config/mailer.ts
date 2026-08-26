import nodemailer from "nodemailer";
import { env } from "./env";

// SMTP Transporter setup using Nodemailer
// Can be linked to Ethereal Mail for sandbox testing or production SMTP providers
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // Use SSL for port 465, TLS/STARTTLS for others
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});
