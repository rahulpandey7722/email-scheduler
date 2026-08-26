"use client";

import React, { useState } from "react";
import { CsvUploader } from "./CsvUploader";
import { apiClient } from "@/lib/apiClient";
import { Send, Clock, AlertCircle, Sparkles } from "lucide-react";

interface ComposeFormProps {
  onSuccessScheduled?: () => void;
}

export function ComposeForm({ onSuccessScheduled }: ComposeFormProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [manualRecipients, setManualRecipients] = useState("");
  const [csvRecipients, setCsvRecipients] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Merge manual text input recipients with parsed CSV list
    const manualList = manualRecipients
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.includes("@"));

    const combinedRecipients = Array.from(new Set([...manualList, ...csvRecipients]));

    if (combinedRecipients.length === 0) {
      setErrorMessage("Please enter at least one valid recipient email address or upload a CSV file.");
      return;
    }

    if (!scheduledFor) {
      setErrorMessage("Please select a target scheduled dispatch date and time.");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post("/api/emails", {
        subject,
        body,
        recipients: combinedRecipients,
        scheduledFor: new Date(scheduledFor).toISOString(),
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
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
      {errorMessage && (
        <div className="flex items-center space-x-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

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

      {/* Action Buttons */}
      <div className="pt-3 flex justify-end">
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
  );
}
