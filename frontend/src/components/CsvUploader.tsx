"use client";

import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { UploadCloud, FileText, CheckCircle2 } from "lucide-react";

interface CsvUploaderProps {
  onRecipientsParsed: (emails: string[]) => void;
}

export function CsvUploader({ onRecipientsParsed }: CsvUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse<string[]>(file, {
      complete: (results) => {
        // Flatten CSV matrix and extract valid email strings
        const extractedEmails = results.data
          .flat()
          .map((item) => (item || "").trim())
          .filter((item): item is string => item.length > 0 && item.includes("@"));

        const uniqueEmails = Array.from(new Set(extractedEmails));
        setParsedCount(uniqueEmails.length);
        onRecipientsParsed(uniqueEmails);
      },
      error: (err) => {
        console.error("Failed to parse CSV file:", err);
      },
    });
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="group relative cursor-pointer border-2 border-dashed border-slate-200 hover:border-brand-500 bg-slate-50/50 hover:bg-brand-50/30 p-4 rounded-xl transition-all flex flex-col items-center justify-center text-center"
      >
        {fileName ? (
          <div className="flex items-center space-x-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{fileName}</span>
            {parsedCount !== null && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                {parsedCount} recipients loaded
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-brand-600 mb-1 transition-colors" />
            <p className="text-xs font-semibold text-slate-700 group-hover:text-brand-600">
              Upload CSV file for batch recipients
            </p>
            <p className="text-[11px] text-slate-400">Click to select .csv file containing email list</p>
          </div>
        )}
      </div>
    </div>
  );
}
