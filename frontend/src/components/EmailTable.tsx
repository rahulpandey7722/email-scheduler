"use client";

import React, { useState } from "react";
import { ScheduledEmailRecord } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { EmailPreviewModal } from "./EmailPreviewModal";
import { Eye, ExternalLink } from "lucide-react";

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
  const [selectedPreviewEmail, setSelectedPreviewEmail] = useState<ScheduledEmailRecord | null>(null);

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
    <>
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
                <th className="py-3 px-4 text-right">Actions</th>
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
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        {email.etherealUrl && (
                          <a
                            href={email.etherealUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors"
                            title="Open Ethereal Mail Sandbox"
                          >
                            <span>Ethereal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedPreviewEmail(email)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <EmailPreviewModal
        email={selectedPreviewEmail}
        onClose={() => setSelectedPreviewEmail(null)}
      />
    </>
  );
}
