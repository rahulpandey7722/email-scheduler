# 🚀 Production-Grade Email Scheduler System

A distributed, highly available email scheduling system built with **Node.js, Express, BullMQ, Redis, PostgreSQL (Prisma), Next.js 14 (App Router), Tailwind CSS, and NextAuth**.

Designed for zero lost jobs on container restart, dual-layer idempotency, sliding-window user rate limiting, and batch delivery pacing.

---

## 🌐 Live Production Deployment

| Component | Cloud Platform | Live Deployment URL |
| :--- | :--- | :--- |
| **Frontend Web UI** | **Vercel** | [https://email-scheduler-ui.vercel.app](https://vercel.com) *(Import `frontend/` on Vercel)* |
| **Backend API** | **Render** | [https://email-scheduler-api.onrender.com](https://email-scheduler-api.onrender.com/health) |
| **Email Queue Worker** | **Render** | `email-scheduler-worker` *(Render Background Worker)* |
| **PostgreSQL Database** | **Render Postgres** | `email-scheduler-db` *(Render PostgreSQL Service)* |

---

## 🏗️ System Architecture

```
Frontend (Next.js 14 on Vercel) --REST / JWT--> API Server (Express on Render) --writes--> PostgreSQL
                                                        |
                                                        +--enqueues delayed job--> Redis (BullMQ)
                                                                                       |
                                                                             Worker Process (Render)
                                                                             - Hourly rate limit check
                                                                             - Idempotency check
                                                                             - Dispatches via Nodemailer
                                                                             - Updates status (SENT / FAILED)
```

---

## ✨ Features

- **Queue-Based Scheduling**: BullMQ + Redis sorted sets for millisecond-accurate delayed execution without cron jobs.
- **Dual-Layer Anti-Duplication**:
  - **Database Level**: Unique SHA-256 `idempotencyKey` index constraint on PostgreSQL/SQLite.
  - **Cache Level**: Atomic Redis `dispatched:*` markers for fast worker pre-flight short-circuiting.
- **Sliding-Window Rate Limiting**: User-configurable hourly quota limits managed atomically in Redis.
- **Delivery Pacing & Throttling**: Configurable minimum inter-email delay (`delayMs`) to prevent SMTP server rate limits.
- **Restart Resilience**: Redis Append-Only File (`--appendonly yes`) persistence ensures zero lost jobs if servers crash or restart.
- **Interactive Dashboard**: Next.js App Router UI featuring real-time SWR polling for `QUEUED`, `SENDING`, `SENT`, `FAILED`, and `RESCHEDULED` jobs.
- **CSV Batch Upload**: PapaParse integration for uploading large recipient lists from CSV files.
- **Authentication**: Dual support for 1-Click Instant Demo Login and Google OAuth 2.0 via NextAuth.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, SWR, NextAuth.js, PapaParse, Lucide Icons
- **Backend API**: Node.js, Express, TypeScript, Zod, JWT, Pino Logger
- **Database & ORM**: PostgreSQL / SQLite, Prisma ORM
- **Queue & Cache**: BullMQ, Redis (IORedis)
- **Email Transport**: Nodemailer (Ethereal Mail / Custom SMTP)

---

## 📂 Project Structure

```
Email-Scheduler/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Prisma schema (User, Email, EmailRecipient)
│   ├── src/
│   │   ├── config/                # Environment, Redis, Database, Mailer config
│   │   ├── controllers/           # API request controllers
│   │   ├── middleware/            # Auth, validation, error handler middlewares
│   │   ├── queues/                # BullMQ queue definitions
│   │   ├── repositories/          # Prisma database access layer
│   │   ├── routes/                # Express API routes
│   │   ├── services/              # Business logic (rate limiter, idempotency, mailer)
│   │   ├── workers/               # BullMQ worker processor and entrypoint
│   │   ├── app.ts                 # Express application pipeline
│   │   └── server.ts              # API server listener
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── frontend/
    ├── src/
    │   ├── app/                   # Next.js 14 App Router pages
    │   ├── components/            # ComposeForm, CsvUploader, EmailTable, StatusBadge
    │   ├── hooks/                 # Custom SWR data fetching hooks
    │   └── lib/                   # API client, NextAuth configuration, types
    ├── tailwind.config.ts
    └── package.json
```

---

## ⚡ Local Development Setup

### 1. Run Backend API & Worker
```bash
cd backend
npm install
npx prisma generate
npm run dev:api
```
In a second terminal window, start the background worker:
```bash
cd backend
npm run dev:worker
```

### 2. Run Frontend App
In a third terminal window:
```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000`** in your browser!

---

## 📜 License

Distributed under the MIT License.
