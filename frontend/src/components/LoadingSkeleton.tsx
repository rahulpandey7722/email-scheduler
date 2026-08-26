import React from "react";

export function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm p-4 space-y-3 animate-pulse">
      <div className="h-6 bg-slate-100 rounded w-1/4 mb-4" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="h-4 bg-slate-100 rounded w-1/4" />
          <div className="h-4 bg-slate-100 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-1/6" />
          <div className="h-4 bg-slate-100 rounded w-1/4" />
        </div>
      ))}
    </div>
  );
}
