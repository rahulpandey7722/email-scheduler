"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, ShieldCheck, Zap, Calendar, UserCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showConfigNotice, setShowConfigNotice] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handleDemoSignIn = async () => {
    await signIn("demo", { callbackUrl: "/dashboard" });
  };

  const handleGoogleSignIn = async () => {
    // Check if Google Client ID is configured or default dummy
    const isConfigured = process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED === "true";
    if (!isConfigured) {
      setShowConfigNotice(true);
    }
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 text-center space-y-6">
        <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto text-brand-600">
          <Mail className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Scheduler</h1>
          <p className="text-xs text-slate-500 mt-1">
            Production-Grade Distributed Email Scheduling Platform
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 py-2">
          <div className="p-3 bg-slate-50 rounded-xl flex flex-col items-center">
            <Zap className="w-4 h-4 text-brand-600 mb-1" />
            <span className="text-[10px] font-semibold text-slate-700">BullMQ Queue</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl flex flex-col items-center">
            <Calendar className="w-4 h-4 text-emerald-600 mb-1" />
            <span className="text-[10px] font-semibold text-slate-700">Zero Lost Jobs</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl flex flex-col items-center">
            <ShieldCheck className="w-4 h-4 text-indigo-600 mb-1" />
            <span className="text-[10px] font-semibold text-slate-700">Idempotency</span>
          </div>
        </div>

        {showConfigNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-amber-900">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Google OAuth Setup Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Google OAuth requires a registered Client ID in Google Cloud Console. To test immediately without setup, use <strong>1-Click Instant Demo Login</strong> below!
            </p>
          </div>
        )}

        <div className="space-y-3">
          {/* Primary 1-Click Instant Demo Login */}
          <button
            onClick={handleDemoSignIn}
            className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl font-medium text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <UserCheck className="w-5 h-5" />
            <span>1-Click Instant Demo Login</span>
          </button>

          {/* Google OAuth Login */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-medium text-sm transition-all flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V13.4h6.887c-.58 2.719-2.855 4.6-6.887 4.6-4.148 0-7.5-3.352-7.5-7.5s3.352-7.5 7.5-7.5c1.815 0 3.475.65 4.762 1.725l2.482-2.482C17.93 1.05 15.26 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.98 0 12.1-4.91 12.1-12.33 0-.75-.08-1.47-.21-2.165H12.24z" />
            </svg>
            <span>Sign in with Google OAuth</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Secured with JWT authentication and token verification.
        </p>
      </div>
    </div>
  );
}
