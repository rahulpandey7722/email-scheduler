"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { EmailTable } from "@/components/EmailTable";
import { useScheduledEmails } from "@/hooks/useScheduledEmails";
import { useSentEmails } from "@/hooks/useSentEmails";
import { Plus, LogOut, Clock, CheckCircle2, Mail, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");

  const scheduled = useScheduledEmails();
  const sent = useSentEmails();

  const handleRefresh = () => {
    if (activeTab === "scheduled") scheduled.refresh();
    else sent.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Email Scheduler</h1>
              <p className="text-[11px] text-slate-500">Dashboard Control Panel</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/compose"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Compose Email</span>
            </Link>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center space-x-2">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User Avatar"}
                  className="w-8 h-8 rounded-full ring-2 ring-slate-100"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {session?.user?.name?.[0] || "U"}
                </div>
              )}
              <span className="text-xs font-medium text-slate-700 hidden sm:inline-block">
                {session?.user?.name || "User"}
              </span>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Navigation Tabs and Refresh Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-2 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "scheduled"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
              {scheduled.scheduledEmails && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-brand-100 text-brand-700">
                  {scheduled.scheduledEmails.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("sent")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "sent"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Delivered Archive</span>
              {sent.sentEmails && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700">
                  {sent.sentEmails.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl border border-slate-200 transition-all shadow-sm"
            title="Refresh Table Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Email Table Component */}
        {activeTab === "scheduled" ? (
          <EmailTable
            emails={scheduled.scheduledEmails}
            isLoading={scheduled.isLoading}
            error={scheduled.error}
            emptyTitle="No scheduled emails queued"
            emptyMessage="Click 'Compose Email' above to schedule your first email delivery batch."
          />
        ) : (
          <EmailTable
            emails={sent.sentEmails}
            isLoading={sent.isLoading}
            error={sent.error}
            emptyTitle="No delivered email history"
            emptyMessage="Emails that have been successfully dispatched by the worker will appear here."
          />
        )}
      </main>
    </div>
  );
}
