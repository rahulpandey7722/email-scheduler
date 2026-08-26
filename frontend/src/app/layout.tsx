import "./globals.css";
import React from "react";
import { SessionProvider } from "@/components/SessionProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email Scheduler App",
  description: "Production-Grade Distributed Email Scheduling System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
