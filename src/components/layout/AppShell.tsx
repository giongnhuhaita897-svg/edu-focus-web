"use client";

import React from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-edtech-bg text-edtech-text flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 md:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
