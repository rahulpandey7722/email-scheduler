import React from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ message, title = "No emails found" }: { message: string; title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-200 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Inbox className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 max-w-sm">{message}</p>
    </div>
  );
}
