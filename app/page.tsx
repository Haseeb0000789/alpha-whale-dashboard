// app/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import { getSyncedNowMs, parseUtcTimestampMs } from "@/types/types";
import { Zap, Shield, ArrowUpRight, Lock } from "lucide-react";

export default function DashboardOverviewPage() {
  const { signals, spotSignals, stats, walls, authRole, isInitialLoading } =
    useDashboardSocket();
  const [startOfDay, setStartOfDay] = useState<Date | null>(null);

  useEffect(() => {
    const initId = setTimeout(() => {
      const now = new Date(getSyncedNowMs());
      now.setHours(0, 0, 0, 0);
      setStartOfDay(now);
    }, 0);
    return () => clearTimeout(initId);
  }, [signals.length]);

  const signalsTodayCount = useMemo(() => {
    if (!startOfDay) return stats?.total_signals ?? 0;
    const startMs = startOfDay.getTime();
    const liveCount = signals.filter((s) => {
      const ts = parseUtcTimestampMs(s.detected_at);
      return !isNaN(ts) && ts >= startMs;
    }).length;
    return liveCount > 0 ? liveCount : (stats?.total_signals ?? 0);
  }, [signals, startOfDay, stats]);

  const activeCoinsCount = useMemo(() => {
    const uniqueSyms = new Set<string>();
    for (const w of walls)
      if (w.symbol) uniqueSyms.add(w.symbol.trim().toUpperCase());
    for (const s of signals)
      if (s.symbol) uniqueSyms.add(s.symbol.trim().toUpperCase());
    for (const s of spotSignals)
      if (s.symbol) uniqueSyms.add(s.symbol.trim().toUpperCase());
    if (uniqueSyms.size > 0) return uniqueSyms.size;
    return stats?.by_structure?.reduce((acc, item) => acc + item.count, 0) ?? 24;
  }, [walls, signals, spotSignals, stats]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6 pb-32 md:pb-24">
      {/* Freemium VIP Call-To-Action Banner for Unauthenticated Visitors */}
      {!authRole && (
        <Link
          href="/signals"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-[#121418] px-4 py-2.5 text-xs transition hover:border-amber-500/50"
        >
          <div className="flex items-center gap-2 text-slate-200">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="font-semibold">
              🔒 Live Signals &amp; L2 Whale Walls are VIP-only — Unlock Access
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
            <span>Enter VIP Key</span>
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </Link>
      )}

      <StatsCards
        stats={stats}
        signalsTodayCount={signalsTodayCount}
        activeCoinsCount={activeCoinsCount}
        isLoading={isInitialLoading}
      />

      <AnalyticsCharts
        signals={signals}
        stats={stats}
        isLoading={isInitialLoading}
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Link
          href="/signals"
          className="group flex items-center justify-between rounded-xl border border-[#2B3139] bg-[#121418] px-4 py-3 transition-all hover:border-slate-600"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1E2329] text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white group-hover:text-slate-200 sm:text-sm">
                  Open 4-Pillar Signals Grid
                </h3>
                <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                  {authRole
                    ? `${signals.length + spotSignals.length} Active`
                    : "VIP Locked"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Instant 0ms navigation powered by live WebSocket stream
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
        </Link>

        <Link
          href="/walls"
          className="group flex items-center justify-between rounded-xl border border-[#2B3139] bg-[#121418] px-4 py-3 transition-all hover:border-slate-600"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1E2329] text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white group-hover:text-slate-200 sm:text-sm">
                  Open Live Bid Walls Radar
                </h3>
                <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                  {authRole ? `${walls.length} Live Walls` : "VIP Locked"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time L2 whale clusters &amp; order book depth imbalance
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
        </Link>
      </div>
    </main>
  );
}
