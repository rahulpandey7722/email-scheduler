"use client";

import React, { useState, useMemo } from "react";
import { ScheduledEmailRecord, EmailStatus } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { EmailPreviewModal } from "./EmailPreviewModal";
import { Search, Eye, ExternalLink, Filter, Mail, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface EmailHistoryTableProps {
  emails?: ScheduledEmailRecord[];
  isLoading: boolean;
  error?: Error;
}

type FilterStatusOption = "ALL" | "QUEUED" | "SENT" | "FAILED" | "RESCHEDULED";

export function EmailHistoryTable({ emails, isLoading, error }: EmailHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatusOption>("ALL");
  const [selectedPreviewEmail, setSelectedPreviewEmail] = useState<ScheduledEmailRecord | null>(null);

  // Statistics overview calculation
  const stats = useMemo(() => {
    if (!emails) return { total: 0, sent: 0, queued: 0, failed: 0 };
    return {
      total: emails.length,
      sent: emails.filter((e) => e.status === "SENT").length,
      queued: emails.filter((e) => e.status === "QUEUED" || e.status === "PENDING" || e.status === "SENDING").length,
      failed: emails.filter((e) => e.status === "FAILED").length,
    };
  }, [emails]);

  // Filtered dataset calculation
  const filteredEmails = useMemo(() => {
    if (!emails) return [];

    return emails.filter((email) => {
      // 1. Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "QUEUED") {
          if (email.status !== "QUEUED" && email.status !== "PENDING" && email.status !== "SENDING") {
            return false;
          }
        } else if (email.status !== statusFilter) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const subjectMatch = email.subject.toLowerCase().includes(query);
        const recipientMatch = email.recipients.some((r) => r.address.toLowerCase().includes(query));
        const idMatch = email.id.toLowerCase().includes(query);
        if (!subjectMatch && !recipientMatch && !idMatch) return false;
      }

      return true;
    });
  }, [emails, statusFilter, searchQuery]);

  if (isLoading && !emails) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
        Failed to load complete email history: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <Mail className="w-4 h-4 text-brand-600" />
            <span>Total Dispatched</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Delivered</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{stats.sent}</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Queued / Active</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{stats.queued}</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Failed / Errors</span>
          </div>
          <p className="text-2xl font-bold text-rose-700">{stats.failed}</p>
        </div>
      </div>

      {/* Search & Filter Header Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Real-time Search Box */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject, recipient, or ID..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden md:inline">
            Status:
          </span>
          {(["ALL", "QUEUED", "SENT", "FAILED", "RESCHEDULED"] as FilterStatusOption[]).map((option) => (
            <button
              key={option}
              onClick={() => setStatusFilter(option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === option
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {option === "ALL" ? "All Statuses" : option}
            </button>
          ))}
        </div>
      </div>

      {/* Email History Table View */}
      {!filteredEmails || filteredEmails.length === 0 ? (
        <EmptyState
          title="No email history records found"
          message={
            searchQuery || statusFilter !== "ALL"
              ? "No email records match your active search filter criteria."
              : "No email records exist in history yet."
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Recipients</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Sent Date</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmails.map((email) => {
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
                      <td className="py-3.5 px-4 text-gray-600 text-xs whitespace-nowrap font-mono">
                        {email.attempts}
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
      )}

      {/* Detail & Preview Modal */}
      <EmailPreviewModal
        email={selectedPreviewEmail}
        onClose={() => setSelectedPreviewEmail(null)}
      />
    </div>
  );
}
