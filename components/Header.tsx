// components/Header.tsx
"use client";

import React from "react";
import { Activity, RefreshCw, Radio, ShieldAlert, Sparkles } from "lucide-react";

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
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07090E]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-600/20 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
            <Activity className="h-6 w-6 text-emerald-400" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Alpha Whale <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Scanner</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" /> 4-Pillar Engine v5.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-Time Spot Confluence, Smart Money Concepts & L2 Order Book Whale Radar
            </p>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {usingFallback && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Demo Preview Data (FastAPI Offline)</span>
            </div>
          )}

          {error && !usingFallback && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Polling Toggle */}
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-all ${
              isPolling
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.12)]"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${isPolling ? "animate-pulse text-emerald-400" : "text-slate-500"}`} />
            <span>{isPolling ? "Live Sync (7s)" : "Sync Paused"}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={onManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            <span>{ lastUpdated ? `Synced ${lastUpdated.toLocaleTimeString()}` : "Refresh" }</span>
          </button>
        </div>
      </div>
    </header>
  );
}