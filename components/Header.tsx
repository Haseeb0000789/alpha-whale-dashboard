// components/Header.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Activity, RefreshCw, Radio, ShieldAlert, Settings } from "lucide-react";

interface HeaderProps {
  isPolling: boolean;
  setIsPolling: (val: boolean) => void;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  usingFallback: boolean;
  onManualRefresh: () => void;
}

export default function Header({
  isPolling,
  setIsPolling,
  lastUpdated,
  isLoading,
  error,
  usingFallback,
  onManualRefresh,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#2B3139] bg-[#0B0E11]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Brand Identity */}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-[#1E2329]">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-sm font-bold tracking-tight text-white">
              Alpha Terminal
            </h1>
            <span className="font-mono text-[10px] font-medium text-slate-500">
              v5.0
            </span>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {usingFallback && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Preview Data</span>
            </div>
          )}

          {error && !usingFallback && (
            <div className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              isPolling
                ? "border-[#2B3139] bg-[#1E2329] text-emerald-400"
                : "border-[#2B3139] bg-[#161A1E] text-slate-400"
            }`}
          >
            <Radio
              className={`h-3 w-3 ${
                isPolling ? "animate-pulse text-emerald-400" : "text-slate-500"
              }`}
            />
            <span>{isPolling ? "Live" : "Paused"}</span>
          </button>

          <button
            onClick={onManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-md border border-[#2B3139] bg-[#161A1E] px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading ? "animate-spin text-emerald-400" : ""}`}
            />
            <span>
              {lastUpdated ? `Synced ${lastUpdated.toLocaleTimeString()}` : "Refresh"}
            </span>
          </button>

          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-md border border-[#2B3139] bg-[#161A1E] px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5 text-slate-400" />
            <span>Control Center</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
