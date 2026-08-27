export type EmailStatus = 
  | "PENDING" 
  | "QUEUED" 
  | "SENDING" 
  | "SENT" 
  | "FAILED" 
  | "RESCHEDULED";

export interface RecipientRecord {
  id: string;
  address: string;
}

export interface ScheduledEmailRecord {
  id: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledFor: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  etherealUrl?: string | null;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
  recipients: RecipientRecord[];
}
