# Production-Grade Email Scheduler System
### Full Architecture, Code & Implementation Guide

Stack: Node.js + TypeScript + Express + BullMQ + Redis + PostgreSQL (Prisma) + Next.js + Tailwind + NextAuth (Google OAuth)

---

## Table of Contents

1. Architecture Overview
2. Folder Structure
3. Database Schema (Prisma)
4. Backend Setup (config, env, deps)
5. Redis Configuration
6. BullMQ Queue + Worker
7. Rate Limiting (Redis)
8. Idempotency Strategy
9. Mail Service (Ethereal SMTP)
10. Repositories & Services
11. Controllers & Routes
12. Express App + Server Entrypoints
13. Frontend Setup (Next.js + NextAuth Google OAuth)
14. Frontend Components
15. API Integration Hooks
16. Docker & Deployment
17. Testing Guide (scheduling, restart recovery, rate limiting)

---

## 1. Architecture Overview

```
Frontend (Next.js) --REST--> API Server (Express) --writes--> PostgreSQL
                                     |
                                     +--enqueues delayed job--> Redis (BullMQ)
                                                                    |
                                                          Worker Process (separate)
                                                          - rate limit check (Redis)
                                                          - idempotency check (Redis)
                                                          - send via Ethereal SMTP
                                                          - update Postgres status
```

**Core rules enforced throughout the code:**
- Postgres = source of truth. Redis/BullMQ = execution/trigger mechanism only.
- API process and Worker process are **separate Node entrypoints** — never run in the same process in production.
- No cron. All scheduling uses BullMQ's `delay` option, backed by Redis sorted sets, which survives restarts because it's persisted in Redis (with AOF/RDB enabled).
- Every job carries only an `emailId` — the worker re-fetches fresh data from Postgres at execution time.

---

## 2. Folder Structure

```
email-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   ├── redis.ts
│   │   │   ├── db.ts
│   │   │   └── mailer.ts
│   │   ├── queues/
│   │   │   ├── queue.constants.ts
│   │   │   └── email.queue.ts
│   │   ├── workers/
│   │   │   ├── email.worker.ts
│   │   │   └── worker.entrypoint.ts
│   │   ├── services/
│   │   │   ├── rateLimiter.service.ts
│   │   │   ├── idempotency.service.ts
│   │   │   ├── email.service.ts
│   │   │   └── mail.service.ts
│   │   ├── controllers/
│   │   │   └── email.controller.ts
│   │   ├── routes/
│   │   │   ├── email.routes.ts
│   │   │   └── auth.routes.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── validate.ts
│   │   ├── repositories/
│   │   │   ├── email.repository.ts
│   │   │   └── user.repository.ts
│   │   ├── types/
│   │   │   └── job.types.ts
│   │   ├── utils/
│   │   │   └── logger.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── api/auth/[...nextauth]/route.ts
    │   │   └── dashboard/
    │   │       ├── page.tsx
    │   │       └── compose/page.tsx
    │   ├── components/
    │   │   ├── EmailTable.tsx
    │   │   ├── ComposeForm.tsx
    │   │   ├── CsvUploader.tsx
    │   │   ├── StatusBadge.tsx
    │   │   ├── EmptyState.tsx
    │   │   └── LoadingSkeleton.tsx
    │   ├── lib/
    │   │   ├── apiClient.ts
    │   │   └── types.ts
    │   └── hooks/
    │       ├── useScheduledEmails.ts
    │       └── useSentEmails.ts
    ├── .env.local.example
    ├── tailwind.config.ts
    └── package.json
```

---

## 3. Database Schema (Prisma)

`backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EmailStatus {
  PENDING
  QUEUED
  SENDING
  SENT
  FAILED
  RESCHEDULED
}

model User {
  id        String   @id @default(uuid())
  googleId  String   @unique
  email     String   @unique
  name      String
  avatarUrl String?
  createdAt DateTime @default(now())

  emails Email[]
}

model Email {
  id            String      @id @default(uuid())
  user          User        @relation(fields: [userId], references: [id])
  userId        String

  subject       String
  body          String

  // Scheduling
  scheduledFor  DateTime
  delayMs       Int         @default(2000)   // min delay between sends in a batch
  hourlyLimit   Int         @default(200)

  // Idempotency: unique key derived from (userId + recipient + subject + scheduledFor)
  idempotencyKey String     @unique

  status        EmailStatus @default(PENDING)
  attempts      Int         @default(0)
  lastError     String?

  bullJobId     String?     // reference to the BullMQ job for cancellation/inspection
  sentAt        DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  recipients    EmailRecipient[]

  @@index([userId, status])
  @@index([scheduledFor])
}

model EmailRecipient {
  id       String  @id @default(uuid())
  email    Email   @relation(fields: [emailId], references: [id])
  emailId  String
  address  String

  @@index([emailId])
}
```

**Why `idempotencyKey` is a unique DB column, not just a Redis key:** Redis keys can expire or be flushed. The DB unique constraint is the permanent, unbreakable guarantee — Redis is just a fast pre-check to avoid hitting Postgres on every duplicate attempt.

---

## 4. Backend Setup

`backend/package.json`

```json
{
  "name": "email-scheduler-backend",
  "version": "1.0.0",
  "scripts": {
    "dev:api": "tsx watch src/server.ts",
    "dev:worker": "tsx watch src/workers/worker.entrypoint.ts",
    "build": "tsc",
    "start:api": "node dist/server.js",
    "start:worker": "node dist/workers/worker.entrypoint.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.19.0",
    "bullmq": "^5.12.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "google-auth-library": "^9.13.0",
    "ioredis": "^5.4.1",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.14",
    "pino": "^9.3.2",
    "pino-http": "^10.2.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^22.5.0",
    "prisma": "^5.19.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4"
  }
}
```

`backend/.env.example`

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_scheduler

REDIS_HOST=localhost
REDIS_PORT=6379

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_user
SMTP_PASS=your_ethereal_pass

GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=replace_with_long_random_string

MIN_DELAY_MS=2000
DEFAULT_HOURLY_LIMIT=200
WORKER_CONCURRENCY=10
```

`backend/src/config/env.ts`

```ts
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),

  GOOGLE_CLIENT_ID: z.string(),
  JWT_SECRET: z.string().min(16),

  MIN_DELAY_MS: z.coerce.number().default(2000),
  DEFAULT_HOURLY_LIMIT: z.coerce.number().default(200),
  WORKER_CONCURRENCY: z.coerce.number().default(10),
});

// Fail fast on boot if config is invalid — never discover a missing env var in production at 2am.
export const env = envSchema.parse(process.env);
```

`backend/src/config/redis.ts`

```ts
import IORedis from "ioredis";
import { env } from "./env";

// maxRetriesPerRequest: null is REQUIRED by BullMQ — it disables ioredis's own
// retry-limiting so BullMQ can manage retries/backoff itself.
export const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

connection.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});
```

`backend/src/config/db.ts`

```ts
import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance per process (API and Worker each get their own process-level instance).
export const prisma = new PrismaClient();
```

`backend/src/config/mailer.ts`

```ts
import nodemailer from "nodemailer";
import { env } from "./env";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});
```

---

## 5. Redis Configuration Notes

Redis needs persistence enabled or a restart wipes pending delayed jobs. In `docker-compose.yml` (Section 16) we mount a volume and enable AOF:

```
command: redis-server --appendonly yes
```

This is the single most important line for meeting your "no lost jobs on restart" requirement at the Redis layer. BullMQ jobs live in Redis as sorted sets (`bull:email-jobs:delayed`) — with AOF on, Redis replays its append-only log on restart and the delayed jobs reappear exactly where they were.

---

## 6. BullMQ Queue + Worker

`backend/src/queues/queue.constants.ts`

```ts
export const EMAIL_QUEUE_NAME = "email-jobs";
export const SEND_EMAIL_JOB = "send-email";
```

`backend/src/types/job.types.ts`

```ts
export interface SendEmailJobData {
  emailId: string;
}
```

`backend/src/queues/email.queue.ts`

```ts
import { Queue } from "bullmq";
import { connection } from "../config/redis";
import { EMAIL_QUEUE_NAME } from "./queue.constants";
import { SendEmailJobData } from "../types/job.types";

export const emailQueue = new Queue<SendEmailJobData>(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 }, // 5s, 10s, 20s, 40s, 80s
    removeOnComplete: { age: 3600 },   // keep 1hr for observability, then GC
    removeOnFail: false,                // keep failed jobs for manual inspection
  },
});

/**
 * Enqueue an email to be sent at `scheduledFor`.
 * jobId = emailId guarantees BullMQ-level dedup: adding the same emailId twice
 * is a no-op at the queue level (belt-and-suspenders with the DB idempotency key).
 */
export async function scheduleEmailJob(emailId: string, scheduledFor: Date) {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());

  const job = await emailQueue.add(
    "send-email",
    { emailId },
    {
      delay,
      jobId: emailId,
    }
  );

  return job.id;
}

/** Used when rate limit is hit — pushes the job to the next available hour window. */
export async function rescheduleEmailJob(emailId: string, newDelayMs: number) {
  // BullMQ doesn't support "modify delay in place" cleanly, so we remove + re-add.
  const existing = await emailQueue.getJob(emailId);
  if (existing) await existing.remove();

  return emailQueue.add(
    "send-email",
    { emailId },
    { delay: newDelayMs, jobId: `${emailId}-r${Date.now()}` }
  );
}
```

`backend/src/workers/email.worker.ts`

```ts
import { Worker, Job } from "bullmq";
import { connection } from "../config/redis";
import { EMAIL_QUEUE_NAME } from "../queues/queue.constants";
import { SendEmailJobData } from "../types/job.types";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { rateLimiter } from "../services/rateLimiter.service";
import { isDuplicate, markDispatched } from "../services/idempotency.service";
import { sendEmail } from "../services/mail.service";
import { rescheduleEmailJob } from "../queues/email.queue";
import { logger } from "../utils/logger";

async function processJob(job: Job<SendEmailJobData>) {
  const { emailId } = job.data;

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { recipients: true },
  });

  if (!email) {
    logger.warn({ emailId }, "Email record no longer exists, skipping job");
    return;
  }

  // Already sent (e.g. worker crashed after send but before job ack) — do nothing.
  if (email.status === "SENT") {
    logger.info({ emailId }, "Already SENT, skipping (idempotency short-circuit)");
    return;
  }

  // Redis-level fast duplicate check (in addition to DB unique constraint on idempotencyKey).
  const duplicate = await isDuplicate(email.idempotencyKey);
  if (duplicate) {
    logger.info({ emailId }, "Duplicate detected via Redis, skipping");
    return;
  }

  // Hourly rate limit check.
  const allowed = await rateLimiter.tryConsume(email.userId, email.hourlyLimit);
  if (!allowed) {
    const nextSlotDelayMs = rateLimiter.msUntilNextHourWindow();
    logger.info({ emailId, nextSlotDelayMs }, "Rate limit exceeded, rescheduling");

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "RESCHEDULED" },
    });

    await rescheduleEmailJob(emailId, nextSlotDelayMs);
    return;
  }

  await prisma.email.update({ where: { id: emailId }, data: { status: "SENDING" } });

  try {
    await sendEmail({
      to: email.recipients.map((r) => r.address),
      subject: email.subject,
      body: email.body,
    });

    await markDispatched(email.idempotencyKey);

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "SENT", sentAt: new Date() },
    });

    logger.info({ emailId }, "Email sent successfully");
  } catch (err: any) {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: err.message?.slice(0, 500),
      },
    });
    // Re-throw so BullMQ's retry/backoff mechanism kicks in.
    throw err;
  }

  // Minimum delay before this worker slot picks up the next job — smooths bursts
  // and respects the "delay between emails" requirement even under concurrency.
  await new Promise((resolve) => setTimeout(resolve, env.MIN_DELAY_MS));
}

export const emailWorker = new Worker<SendEmailJobData>(
  EMAIL_QUEUE_NAME,
  processJob,
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY, // configurable parallel jobs
  }
);

emailWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Job failed permanently or will retry");
});

emailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});
```

`backend/src/workers/worker.entrypoint.ts`

```ts
import "../config/env";
import { emailWorker } from "./email.worker";
import { logger } from "../utils/logger";

logger.info("Email worker process started");

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing worker gracefully...");
  await emailWorker.close();
  process.exit(0);
});
```

**Why concurrency + `MIN_DELAY_MS` together satisfy your two separate requirements:** `concurrency: 10` lets 10 jobs run *in parallel* (throughput), while the `setTimeout` at the end of each job's execution throttles *that specific worker slot's* next pickup (pacing). This gives you both "process many in parallel" and "don't blast the SMTP server with zero gaps."

---

## 7. Rate Limiting (Redis-based)

`backend/src/services/rateLimiter.service.ts`

```ts
import { connection } from "../config/redis";

/**
 * Sliding-hour-window counter per user, using a Redis key that changes each hour
 * (e.g. "ratelimit:userId:2026-08-26T14") and auto-expires via TTL.
 * This is atomic (INCR) and safe across multiple worker processes.
 */
class RateLimiterService {
  private keyFor(userId: string, date = new Date()) {
    const hourBucket = date.toISOString().slice(0, 13); // "2026-08-26T14"
    return `ratelimit:${userId}:${hourBucket}`;
  }

  async tryConsume(userId: string, hourlyLimit: number): Promise<boolean> {
    const key = this.keyFor(userId);

    // INCR is atomic — safe even if 50 workers call this at the same instant.
    const count = await connection.incr(key);

    if (count === 1) {
      // First increment in this hour bucket — set expiry so old buckets are auto-cleaned.
      await connection.expire(key, 3600);
    }

    return count <= hourlyLimit;
  }

  msUntilNextHourWindow(): number {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.getTime() - now.getTime();
  }
}

export const rateLimiter = new RateLimiterService();
```

**Why hour-bucket keys instead of a rolling window:** simpler, atomic, and self-cleaning via TTL — no need for sorted-set timestamp pruning. The tradeoff (bursts at bucket boundaries) is acceptable for "200/hour" style limits; if you need a strict rolling window later, swap this for a Redis sorted-set sliding-window algorithm without touching any calling code.

---

## 8. Idempotency Strategy

`backend/src/services/idempotency.service.ts`

```ts
import { connection } from "../config/redis";
import crypto from "crypto";

const TTL_SECONDS = 60 * 60 * 24; // 24h safety window

export function buildIdempotencyKey(params: {
  userId: string;
  subject: string;
  scheduledFor: Date;
  recipients: string[];
}) {
  const raw = `${params.userId}|${params.subject}|${params.scheduledFor.toISOString()}|${params.recipients
    .sort()
    .join(",")}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Fast pre-check before hitting Postgres. */
export async function isDuplicate(idempotencyKey: string): Promise<boolean> {
  const exists = await connection.get(`dispatched:${idempotencyKey}`);
  return exists !== null;
}

/** SETNX-style atomic mark, called only after successful send. */
export async function markDispatched(idempotencyKey: string) {
  await connection.set(`dispatched:${idempotencyKey}`, "1", "EX", TTL_SECONDS);
}
```

**Two layers of protection, by design:**
1. **DB unique constraint** on `Email.idempotencyKey` — the permanent guarantee, survives Redis flush.
2. **Redis `dispatched:*` key** — a fast in-flight check so the worker doesn't need a DB round-trip on every duplicate job attempt (e.g. from BullMQ retries after a crash mid-send).

---

## 9. Mail Service (Ethereal SMTP)

`backend/src/services/mail.service.ts`

```ts
import { transporter } from "../config/mailer";
import { logger } from "../utils/logger";

interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
}

export async function sendEmail({ to, subject, body }: SendEmailParams) {
  const info = await transporter.sendMail({
    from: '"Email Scheduler" <no-reply@scheduler.test>',
    to: to.join(","),
    subject,
    text: body,
    html: `<p>${body}</p>`,
  });

  // Ethereal gives you a preview URL — invaluable for manual testing without a real inbox.
  logger.info({ previewUrl: require("nodemailer").getTestMessageUrl(info) }, "Preview URL");

  return info;
}
```

---

## 10. Repositories & Services

`backend/src/repositories/email.repository.ts`

```ts
import { prisma } from "../config/db";
import { EmailStatus } from "@prisma/client";

export const emailRepository = {
  create: (data: Parameters<typeof prisma.email.create>[0]["data"]) =>
    prisma.email.create({ data }),

  findByUserAndStatus: (userId: string, statuses: EmailStatus[]) =>
    prisma.email.findMany({
      where: { userId, status: { in: statuses } },
      include: { recipients: true },
      orderBy: { scheduledFor: "asc" },
    }),

  findById: (id: string) =>
    prisma.email.findUnique({ where: { id }, include: { recipients: true } }),
};
```

`backend/src/repositories/user.repository.ts`

```ts
import { prisma } from "../config/db";

export const userRepository = {
  findOrCreateByGoogleProfile: (profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }) =>
    prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: { name: profile.name, avatarUrl: profile.avatarUrl },
      create: profile,
    }),
};
```

`backend/src/services/email.service.ts`

```ts
import { emailRepository } from "../repositories/email.repository";
import { buildIdempotencyKey } from "./idempotency.service";
import { scheduleEmailJob } from "../queues/email.queue";
import { env } from "../config/env";

interface CreateScheduleInput {
  userId: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledFor: Date;
  delayMs?: number;
  hourlyLimit?: number;
}

export const emailService = {
  async createSchedule(input: CreateScheduleInput) {
    const idempotencyKey = buildIdempotencyKey({
      userId: input.userId,
      subject: input.subject,
      scheduledFor: input.scheduledFor,
      recipients: input.recipients,
    });

    // DB unique constraint on idempotencyKey will throw (P2002) on true duplicates —
    // caller (controller) translates that into a 409 Conflict.
    const email = await emailRepository.create({
      userId: input.userId,
      subject: input.subject,
      body: input.body,
      scheduledFor: input.scheduledFor,
      delayMs: input.delayMs ?? env.MIN_DELAY_MS,
      hourlyLimit: input.hourlyLimit ?? env.DEFAULT_HOURLY_LIMIT,
      idempotencyKey,
      recipients: { create: input.recipients.map((address) => ({ address })) },
    });

    const bullJobId = await scheduleEmailJob(email.id, input.scheduledFor);

    return emailRepository.findById(email.id) ?? email;
  },

  getScheduled: (userId: string) =>
    emailRepository.findByUserAndStatus(userId, ["PENDING", "QUEUED", "RESCHEDULED"]),

  getSent: (userId: string) => emailRepository.findByUserAndStatus(userId, ["SENT"]),
};
```

---

## 11. Controllers & Routes

`backend/src/middleware/validate.ts`

```ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
```

`backend/src/controllers/email.controller.ts`

```ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { emailService } from "../services/email.service";

export const createScheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
  scheduledFor: z.coerce.date(),
  delayMs: z.number().int().positive().optional(),
  hourlyLimit: z.number().int().positive().optional(),
});

export const emailController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id; // set by auth middleware
      const email = await emailService.createSchedule({ userId, ...req.body });
      res.status(201).json(email);
    } catch (err: any) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Duplicate email schedule (idempotency)" });
      }
      next(err);
    }
  },

  async listScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const emails = await emailService.getScheduled(req.user!.id);
      res.json(emails);
    } catch (err) {
      next(err);
    }
  },

  async listSent(req: Request, res: Response, next: NextFunction) {
    try {
      const emails = await emailService.getSent(req.user!.id);
      res.json(emails);
    } catch (err) {
      next(err);
    }
  },
};
```

`backend/src/middleware/auth.middleware.ts`

```ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

/**
 * Frontend (NextAuth) issues its own session, then calls the backend with a
 * short-lived JWT (signed with JWT_SECRET, shared secret between FE and BE)
 * in the Authorization header. This middleware verifies it.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

`backend/src/routes/email.routes.ts`

```ts
import { Router } from "express";
import { emailController, createScheduleSchema } from "../controllers/email.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authMiddleware);
router.post("/", validate(createScheduleSchema), emailController.create);
router.get("/scheduled", emailController.listScheduled);
router.get("/sent", emailController.listSent);

export default router;
```

`backend/src/routes/auth.routes.ts`

```ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import { userRepository } from "../repositories/user.repository";

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// Frontend sends the Google ID token it received from NextAuth; backend verifies
// it directly with Google, then issues its OWN JWT scoped to this API.
router.post("/google", async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid Google token" });

    const user = await userRepository.findOrCreateByGoogleProfile({
      googleId: payload.sub,
      email: payload.email!,
      name: payload.name ?? "",
      avatarUrl: payload.picture,
    });

    const token = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

export default router;
```

---

## 12. Express App + Server Entrypoints

`backend/src/middleware/errorHandler.ts`

```ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, "Unhandled error");
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal server error" });
}
```

`backend/src/utils/logger.ts`

```ts
import pino from "pino";
export const logger = pino({ level: process.env.NODE_ENV === "production" ? "info" : "debug" });
```

`backend/src/app.ts`

```ts
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);

app.use(errorHandler);
```

`backend/src/server.ts`

```ts
import { env } from "./config/env";
import { app } from "./app";
import { logger } from "./utils/logger";

app.listen(env.PORT, () => {
  logger.info(`API server listening on port ${env.PORT}`);
});
```

---

## 13. Frontend Setup (Next.js + NextAuth Google OAuth)

`frontend/package.json` (key deps)

```json
{
  "dependencies": {
    "next": "^14.2.5",
    "next-auth": "^4.24.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "papaparse": "^5.4.1",
    "swr": "^2.2.5"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.9",
    "typescript": "^5.5.4"
  }
}
```

`frontend/.env.local.example`

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_long_random_string
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_API_URL=http://localhost:4000
```

`frontend/src/app/api/auth/[...nextauth]/route.ts`

```ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Persist the raw Google id_token so we can forward it to our own backend,
    // which exchanges it for our own API-scoped JWT (see auth.routes.ts).
    async jwt({ token, account }) {
      if (account?.id_token) token.idToken = account.id_token;
      return token;
    },
    async session({ session, token }) {
      (session as any).idToken = token.idToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
```

`frontend/src/lib/types.ts`

```ts
export type EmailStatus = "PENDING" | "QUEUED" | "SENDING" | "SENT" | "FAILED" | "RESCHEDULED";

export interface EmailRecord {
  id: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledFor: string;
  sentAt: string | null;
  recipients: { address: string }[];
}
```

`frontend/src/lib/apiClient.ts`

```ts
import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getAuthHeader() {
  const session = await getSession();
  const idToken = (session as any)?.idToken;
  if (!idToken) throw new Error("Not authenticated");

  // Exchange Google idToken for our backend JWT (cache this in practice; simplified here).
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const { token } = await res.json();
  return { Authorization: `Bearer ${token}` };
}

export const apiClient = {
  async get(path: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  },

  async post(path: string, body: unknown) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
  },
};
```

---

## 14. Frontend Components

`frontend/src/app/page.tsx` (Login)

```tsx
"use client";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Email Scheduler</h1>
        <button
          onClick={() => signIn("google")}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
```

`frontend/src/components/StatusBadge.tsx`

```tsx
import { EmailStatus } from "@/lib/types";

const COLORS: Record<EmailStatus, string> = {
  PENDING: "bg-gray-200 text-gray-700",
  QUEUED: "bg-blue-100 text-blue-700",
  SENDING: "bg-yellow-100 text-yellow-700",
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  RESCHEDULED: "bg-purple-100 text-purple-700",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${COLORS[status]}`}>
      {status}
    </span>
  );
}
```

`frontend/src/components/EmptyState.tsx`

```tsx
export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12 text-gray-400">{message}</div>;
}
```

`frontend/src/components/LoadingSkeleton.tsx`

```tsx
export function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded" />
      ))}
    </div>
  );
}
```

`frontend/src/components/EmailTable.tsx`

```tsx
import { EmailRecord } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function EmailTable({
  emails,
  isLoading,
  error,
}: {
  emails?: EmailRecord[];
  isLoading: boolean;
  error?: Error;
}) {
  if (isLoading) return <LoadingSkeleton />;
  if (error) return <div className="text-red-500">Failed to load emails.</div>;
  if (!emails || emails.length === 0) return <EmptyState message="No emails yet." />;

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Recipients</th>
          <th>Subject</th>
          <th>Status</th>
          <th>Scheduled For</th>
        </tr>
      </thead>
      <tbody>
        {emails.map((email) => (
          <tr key={email.id} className="border-b hover:bg-gray-50">
            <td className="py-2">{email.recipients.map((r) => r.address).join(", ")}</td>
            <td>{email.subject}</td>
            <td><StatusBadge status={email.status} /></td>
            <td>{new Date(email.scheduledFor).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`frontend/src/components/CsvUploader.tsx`

```tsx
"use client";
import Papa from "papaparse";

export function CsvUploader({ onParsed }: { onParsed: (emails: string[]) => void }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<string[]>(file, {
      complete: (result) => {
        const emails = result.data
          .flat()
          .map((v) => v?.trim())
          .filter((v): v is string => !!v && v.includes("@"));
        onParsed(emails);
      },
    });
  }

  return (
    <input
      type="file"
      accept=".csv"
      onChange={handleFile}
      className="block text-sm text-gray-600"
    />
  );
}
```

`frontend/src/components/ComposeForm.tsx`

```tsx
"use client";
import { useState } from "react";
import { CsvUploader } from "./CsvUploader";
import { apiClient } from "@/lib/apiClient";

export function ComposeForm({ onScheduled }: { onScheduled: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/api/emails", {
        subject,
        body,
        recipients,
        scheduledFor: new Date(scheduledFor).toISOString(),
        delayMs,
        hourlyLimit,
      });
      onScheduled();
    } catch (err: any) {
      setError(err.message ?? "Failed to schedule email");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
        className="w-full border rounded px-3 py-2"
      />
      <textarea
        placeholder="Body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        className="w-full border rounded px-3 py-2"
        rows={4}
      />
      <CsvUploader onParsed={setRecipients} />
      {recipients.length > 0 && (
        <p className="text-xs text-gray-500">{recipients.length} recipients loaded</p>
      )}
      <input
        type="datetime-local"
        value={scheduledFor}
        onChange={(e) => setScheduledFor(e.target.value)}
        required
        className="w-full border rounded px-3 py-2"
      />
      <div className="flex gap-4">
        <label className="flex-1 text-sm">
          Delay between emails (ms)
          <input
            type="number"
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <label className="flex-1 text-sm">
          Hourly limit
          <input
            type="number"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </label>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting || recipients.length === 0}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {submitting ? "Scheduling..." : "Schedule Email"}
      </button>
    </form>
  );
}
```

---

## 15. API Integration Hooks

`frontend/src/hooks/useScheduledEmails.ts`

```ts
import useSWR from "swr";
import { apiClient } from "@/lib/apiClient";
import { EmailRecord } from "@/lib/types";

export function useScheduledEmails() {
  const { data, error, isLoading, mutate } = useSWR<EmailRecord[]>(
    "/api/emails/scheduled",
    (path) => apiClient.get(path),
    { refreshInterval: 10000 } // poll — good enough for a dashboard; swap for websockets later if needed
  );
  return { emails: data, error, isLoading, refresh: mutate };
}
```

`frontend/src/hooks/useSentEmails.ts`

```ts
import useSWR from "swr";
import { apiClient } from "@/lib/apiClient";
import { EmailRecord } from "@/lib/types";

export function useSentEmails() {
  const { data, error, isLoading } = useSWR<EmailRecord[]>(
    "/api/emails/sent",
    (path) => apiClient.get(path),
    { refreshInterval: 15000 }
  );
  return { emails: data, error, isLoading };
}
```

`frontend/src/app/dashboard/page.tsx`

```tsx
"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { EmailTable } from "@/components/EmailTable";
import { useScheduledEmails } from "@/hooks/useScheduledEmails";
import { useSentEmails } from "@/hooks/useSentEmails";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");

  const scheduled = useScheduledEmails();
  const sent = useSentEmails();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <img src={session.user.image} className="w-8 h-8 rounded-full" alt="" />
          )}
          <span className="font-medium">{session?.user?.name}</span>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/compose" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
            Compose
          </Link>
          <button onClick={() => signOut()} className="text-sm text-gray-500">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b mb-4">
        <button
          onClick={() => setTab("scheduled")}
          className={`pb-2 ${tab === "scheduled" ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}
        >
          Scheduled
        </button>
        <button
          onClick={() => setTab("sent")}
          className={`pb-2 ${tab === "sent" ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}
        >
          Sent
        </button>
      </div>

      {tab === "scheduled" ? (
        <EmailTable emails={scheduled.emails} isLoading={scheduled.isLoading} error={scheduled.error} />
      ) : (
        <EmailTable emails={sent.emails} isLoading={sent.isLoading} error={sent.error} />
      )}
    </div>
  );
}
```

`frontend/src/app/dashboard/compose/page.tsx`

```tsx
"use client";
import { useRouter } from "next/navigation";
import { ComposeForm } from "@/components/ComposeForm";

export default function ComposePage() {
  const router = useRouter();
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Compose Email</h1>
      <ComposeForm onScheduled={() => router.push("/dashboard")} />
    </div>
  );
}
```

---

## 16. Docker & Deployment

`backend/docker-compose.yml`

```yaml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes   # persistence: survives container restart
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: email_scheduler
    ports:
      - "5432:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data

  api:
    build: .
    command: npm run start:api
    env_file: .env
    ports:
      - "4000:4000"
    depends_on:
      - redis
      - postgres

  worker:
    build: .
    command: npm run start:worker
    env_file: .env
    depends_on:
      - redis
      - postgres
    # Scale workers independently of the API: docker compose up --scale worker=3

volumes:
  redis-data:
  pg-data:
```

`backend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["node", "dist/server.js"]
```

**Deployment steps:**

1. `docker compose up -d redis postgres`
2. `npx prisma migrate deploy` (applies schema to Postgres)
3. `npm run build`
4. Start API: `npm run start:api` (or `docker compose up -d api`)
5. Start Worker as a **separate process/container**: `npm run start:worker` (or `docker compose up -d worker`, scale with `--scale worker=3`)
6. Deploy frontend (`npm run build && npm start`, or Vercel) with `NEXT_PUBLIC_API_URL` pointing at the deployed API.
7. In Google Cloud Console, add both `http://localhost:3000` (dev) and your production domain to Authorized redirect URIs for OAuth.

---

## 17. Testing Guide

### A. Test basic scheduling
1. Start Redis + Postgres (`docker compose up -d redis postgres`).
2. Run migrations: `npx prisma migrate dev`.
3. Start API (`npm run dev:api`) and Worker (`npm run dev:worker`) in separate terminals.
4. POST to `/api/emails` with `scheduledFor` = 30 seconds in the future.
5. Watch the worker terminal — it should log "Email sent successfully" ~30s later, and print the Ethereal preview URL. Open that URL to see the actual rendered email.

### B. Test restart recovery (the "no cron, no lost jobs" requirement)
1. Schedule an email for 2 minutes in the future.
2. Immediately kill the worker process (`Ctrl+C`).
3. Confirm the job is still in Redis: `redis-cli --scan --pattern "bull:email-jobs:*"`.
4. Wait past the 2-minute mark with the worker still down — nothing happens (expected).
5. Restart the worker (`npm run dev:worker`). BullMQ picks up the still-pending delayed job immediately (since its delay already expired) and processes it.
6. Also test a **full Redis container restart** mid-delay: `docker compose restart redis` — because AOF persistence is enabled, the delayed job survives and still fires at the correct time.

### C. Test rate limiting
1. Set `hourlyLimit: 5` on a test schedule (via API body) and schedule 10 emails for the same user, same `scheduledFor` timestamp.
2. Run the worker and observe: the first 5 process and hit `SENT`; the remaining 5 should log "Rate limit exceeded, rescheduling" and move to `RESCHEDULED` status, re-queued for the next hour boundary.
3. Verify via `redis-cli GET ratelimit:<userId>:<hourBucket>` that the counter caps at exactly the limit.
4. Verify via the DB that no more than `hourlyLimit` rows show `status = SENT` within any given clock hour for that user.

### D. Test idempotency
1. Submit the exact same schedule payload (same subject, recipients, scheduledFor) twice.
2. First request → `201 Created`.
3. Second request → `409 Conflict` (caught via Prisma's `P2002` unique constraint error on `idempotencyKey`).
4. As a deeper test: manually re-add the same `emailId` to the BullMQ queue twice (simulating a duplicate trigger) — because `jobId: emailId` is used, BullMQ silently ignores the second `add()` call.

### E. Load test (1000+ emails)
1. Write a small script that POSTs 1000 schedule requests with staggered `scheduledFor` values within the same hour and same user.
2. Set `WORKER_CONCURRENCY=10` and `hourlyLimit=200`.
3. Confirm: at most 200 reach `SENT` in that hour, concurrency never exceeds 10 simultaneous SMTP sends (check Ethereal/logs), and the remaining ~800 end up `RESCHEDULED` into subsequent hourly buckets.

---

## What to build first if this feels like a lot

Recommended build order for a working end-to-end slice before polishing:
1. Prisma schema → migrate → confirm tables exist.
2. `config/` + `queues/` + `workers/email.worker.ts` → confirm a manually-added test job actually sends via Ethereal.
3. `services/rateLimiter` + `idempotency` → wire into the worker.
4. Controllers/routes + `auth.middleware` (stub auth first, add real Google OAuth last).
5. Frontend: login → dashboard → compose, in that order.

This order lets you verify the hardest, most failure-prone part (queue + worker + persistence) before touching any UI.
