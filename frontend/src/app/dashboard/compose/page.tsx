"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ComposeForm } from "@/components/ComposeForm";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

export default function ComposePage() {
  const router = useRouter();

  const handleScheduledSuccess = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            className="p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Compose New Schedule</h1>
            <p className="text-xs text-slate-500">Configure email targets, schedule timing, and throttling parameters</p>
          </div>
        </div>

        <ComposeForm onSuccessScheduled={handleScheduledSuccess} />
      </div>
    </div>
  );
}
