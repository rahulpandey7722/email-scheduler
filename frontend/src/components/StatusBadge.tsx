import React from "react";
import { EmailStatus } from "@/lib/types";

const STATUS_COLOR_MAP: Record<EmailStatus, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  QUEUED: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  SENDING: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  SENT: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  FAILED: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  RESCHEDULED: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  const config = STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP.PENDING;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
