import nodemailer from "nodemailer";
import { env } from "./env";
import { logger } from "../utils/logger";

let etherealTestAccount: nodemailer.TestAccount | null = null;

// Base static transporter built from environment variables
export const staticTransporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Gets or dynamically creates an Ethereal sandbox test account if standard SMTP credentials are unset or placeholders
 */
export async function getEtherealAccountInfo() {
  if (!etherealTestAccount) {
    try {
      etherealTestAccount = await nodemailer.createTestAccount();
      logger.info(
        { user: etherealTestAccount.user, pass: etherealTestAccount.pass, webmail: etherealTestAccount.web },
        "[Ethereal Mail] Dynamically initialized sandbox account"
      );
    } catch (err: any) {
      logger.warn({ error: err.message }, "Failed to generate Ethereal test account, using environment defaults");
    }
  }
  return etherealTestAccount;
}

/**
 * Returns active Nodemailer transporter (auto-configuring Ethereal if using dev sandbox)
 */
export async function getActiveTransporter() {
  const isDefaultPlaceholder =
    env.SMTP_USER === "test_user" ||
    env.SMTP_USER === "ethereal_demo_user" ||
    env.SMTP_HOST.includes("ethereal");

  if (isDefaultPlaceholder) {
    const ethereal = await getEtherealAccountInfo();
    if (ethereal) {
      return nodemailer.createTransport({
        host: ethereal.smtp.host,
        port: ethereal.smtp.port,
        secure: ethereal.smtp.secure,
        auth: {
          user: ethereal.user,
          pass: ethereal.pass,
        },
      });
    }
  }

  return staticTransporter;
}

export const transporter = staticTransporter;
