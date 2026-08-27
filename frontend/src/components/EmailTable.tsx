import React from "react";
import { ScheduledEmailRecord } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

interface EmailTableProps {
  emails?: ScheduledEmailRecord[];
  isLoading: boolean;
  error?: Error;
  emptyTitle?: string;
  emptyMessage?: string;
}

export function EmailTable({
  emails,
  isLoading,
  error,
  emptyTitle = "No emails found",
  emptyMessage = "There are no emails matching this view filter.",
}: EmailTableProps) {
  if (isLoading && !emails) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
        Failed to fetch email schedule data: {error.message}
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Recipients</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Scheduled For</th>
              <th className="py-3 px-4">Sent At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {emails.map((email) => {
              const recipientList = email.recipients.map((r) => r.address).join(", ");
              return (
                <tr key={email.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-gray-900 max-w-xs truncate" title={recipientList}>
                    {recipientList}
                  </td>
                  <td className="py-3.5 px-4 text-gray-700 max-w-xs truncate font-normal" title={email.subject}>
                    {email.subject}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={email.status} />
                  </td>
                  <td className="py-3.5 px-4 text-gray-600 text-xs whitespace-nowrap">
                    {new Date(email.scheduledFor).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-gray-500 text-xs whitespace-nowrap">
                    {email.sentAt
                      ? new Date(email.sentAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
