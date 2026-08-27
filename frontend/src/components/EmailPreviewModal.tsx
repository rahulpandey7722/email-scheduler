"use client";

import React from "react";
import { ScheduledEmailRecord } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { X, ExternalLink, Mail, Clock, Send, Users, AlertTriangle } from "lucide-react";

interface EmailPreviewModalProps {
  email: ScheduledEmailRecord | null;
  onClose: () => void;
}

export function EmailPreviewModal({ email, onClose }: EmailPreviewModalProps) {
  if (!email) return null;

  const formattedScheduledDate = new Date(email.scheduledFor).toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "medium",
  });

  const formattedSentDate = email.sentAt
    ? new Date(email.sentAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "medium",
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Email Details & Preview</h2>
              <p className="text-xs text-slate-500 font-mono">ID: {email.id}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status & Metadata Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Current Status
              </span>
              <StatusBadge status={email.status} />
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Scheduled For
              </span>
              <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formattedScheduledDate}</span>
              </div>
            </div>

            {formattedSentDate && (
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Delivered At
                </span>
                <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-medium">
                  <Send className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{formattedSentDate}</span>
                </div>
              </div>
            )}

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Attempt Count / Rate Limits
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {email.attempts} attempt(s) • Delay {email.delayMs}ms
              </span>
            </div>
          </div>

          {/* Last Error Banner if failed */}
          {email.lastError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Delivery Exception Logged:</span>
                <span>{email.lastError}</span>
              </div>
            </div>
          )}

          {/* Ethereal Sandbox Email Link Banner */}
          {email.etherealUrl && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Ethereal Live Sandbox Email</h4>
                  <p className="text-[11px] text-indigo-600">View exact HTML output in Ethereal Mail sandbox</p>
                </div>
              </div>
              <a
                href={email.etherealUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                <span>View Webmail</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Recipients Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Target Recipients ({email.recipients.length})
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {email.recipients.map((rec) => (
                <span
                  key={rec.id || rec.address}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs"
                >
                  <Users className="w-3 h-3 mr-1 text-slate-400" />
                  {rec.address}
                </span>
              ))}
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Subject Line
            </label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900">
              {email.subject}
            </div>
          </div>

          {/* Email Body HTML Card */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Message Content Preview
            </label>
            <div className="p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 space-y-2 shadow-inner min-h-[120px]">
              <div
                className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: email.body.replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-all"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
