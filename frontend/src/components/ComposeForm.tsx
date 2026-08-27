"use client";

import React, { useState } from "react";
import { CsvUploader } from "./CsvUploader";
import { emailStore } from "@/lib/emailStore";
import { Clock, AlertCircle, Eye, Edit3, Mail, Users, CheckCircle2 } from "lucide-react";

interface ComposeFormProps {
  onSuccessScheduled?: () => void;
}

export function ComposeForm({ onSuccessScheduled }: ComposeFormProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [manualRecipients, setManualRecipients] = useState("");
  const [csvRecipients, setCsvRecipients] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const manualList = manualRecipients
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.includes("@"));

  const combinedRecipients = Array.from(new Set([...manualList, ...csvRecipients]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (combinedRecipients.length === 0) {
      setErrorMessage("Please enter at least one valid recipient email address or upload a CSV file.");
      return;
    }

    if (!scheduledFor || isNaN(new Date(scheduledFor).getTime())) {
      setErrorMessage("Please select a valid target scheduled dispatch date and time.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedDate = new Date(scheduledFor).toISOString();

      await emailStore.addEmail({
        subject,
        body,
        recipients: combinedRecipients,
        scheduledFor: formattedDate,
        delayMs,
        hourlyLimit,
      });

      if (onSuccessScheduled) {
        onSuccessScheduled();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit email schedule.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Editor / Live Preview Navigation Tabs */}
      <div className="px-6 pt-4 border-b border-gray-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-t border-x transition-all ${
              activeTab === "edit"
                ? "bg-white text-brand-600 border-slate-200 shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Compose Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-t border-x transition-all ${
              activeTab === "preview"
                ? "bg-white text-brand-600 border-slate-200 shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Live Email Preview</span>
            {combinedRecipients.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-100 text-brand-700">
                {combinedRecipients.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-medium pb-2 hidden sm:block">
          {activeTab === "edit" ? "Fill out form fields below" : "Interactive rendering preview"}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {errorMessage && (
          <div className="flex items-center space-x-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {activeTab === "edit" ? (
          <>
            {/* Subject Line */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Q4 Performance Update & Project Roadmap"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Recipient Input & CSV Uploader */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Recipients
              </label>

              <input
                type="text"
                value={manualRecipients}
                onChange={(e) => setManualRecipients(e.target.value)}
                placeholder="Comma-separated emails: user1@test.com, user2@test.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400"
              />

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] uppercase font-semibold text-slate-400">OR CSV Batch</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <CsvUploader onRecipientsParsed={setCsvRecipients} />
            </div>

            {/* Body Content */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Body Text
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email body content here..."
                rows={5}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400 resize-y"
              />
            </div>

            {/* Scheduling Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dispatch Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Min Inter-email Delay (ms)
                </label>
                <input
                  type="number"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Max Hourly Quota
                </label>
                <input
                  type="number"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </>
        ) : (
          /* Live Email Preview Card View */
          <div className="space-y-5">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Email Dispatch Preview</h3>
                  <p className="text-xs text-slate-500">Rendered preview of message before queueing</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready to Schedule</span>
              </span>
            </div>

            {/* Recipient Pills Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Target Recipients ({combinedRecipients.length})
              </label>
              {combinedRecipients.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-28 overflow-y-auto">
                  {combinedRecipients.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200"
                    >
                      <Users className="w-3 h-3 mr-1 text-slate-400" />
                      {email}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                  No recipient addresses added yet. Return to the Compose Editor to add recipients or upload a CSV file.
                </div>
              )}
            </div>

            {/* Subject Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Subject
              </label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900">
                {subject || <span className="text-slate-400 italic">No subject line provided yet</span>}
              </div>
            </div>

            {/* Rendered HTML Email Content Preview Box */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Rendered HTML Body
              </label>
              <div className="p-5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 shadow-inner min-h-[160px]">
                {body ? (
                  <div
                    className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: `<div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b;">
                        <h2 style="color: #4f46e5; margin-top: 0;">${subject}</h2>
                        <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                          ${body.replace(/\n/g, "<br/>")}
                        </div>
                        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e2e8f0;" />
                        <p style="font-size: 12px; color: #94a3b8;">Sent via Email Scheduler Service</p>
                      </div>`,
                    }}
                  />
                ) : (
                  <span className="text-slate-400 italic">No email body content entered yet.</span>
                )}
              </div>
            </div>

            {/* Scheduled Time Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  Target Scheduled Time:{" "}
                  <strong className="text-slate-800">
                    {scheduledFor ? new Date(scheduledFor).toLocaleString() : "Not set"}
                  </strong>
                </span>
              </div>
              <span>Hourly Quota: {hourlyLimit}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 flex items-center justify-between border-t border-slate-100">
          {activeTab === "preview" ? (
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
            >
              ← Back to Editor
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Live Email</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Scheduling Job...</span>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Schedule Transmission</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
