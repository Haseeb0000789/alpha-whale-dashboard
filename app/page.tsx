// app/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import { getSyncedNowMs, parseUtcTimestampMs } from "@/types/types";
import { Zap, Shield, ArrowUpRight } from "lucide-react";

export default function DashboardOverviewPage() {
  const { signals, spotSignals, stats, walls, isInitialLoading } =
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
    if (!startOfDay) return 0;
    const startMs = startOfDay.getTime();
    return signals.filter((s) => {
      const ts = parseUtcTimestampMs(s.detected_at);
      return !isNaN(ts) && ts >= startMs;
    }).length;
  }, [signals, startOfDay]);

  const activeCoinsCount = useMemo(() => {
    const uniqueSyms = new Set<string>();
    for (const w of walls) if (w.symbol) uniqueSyms.add(w.symbol.trim().toUpperCase());
    for (const s of signals) if (s.symbol) uniqueSyms.add(s.symbol.trim().toUpperCase());
    for (const s of spotSignals) if (s.symbol) uniqueSyms.add(s.symbol.trim().toUpperCase());
    return uniqueSyms.size;
  }, [walls, signals, spotSignals]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6 pb-32 md:pb-24">
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
          className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-[#0B101B] to-cyan-950/20 px-4 py-3 transition-all hover:border-cyan-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 sm:text-sm">
                  Open 4-Pillar Signals Grid
                </h3>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                  {signals.length + spotSignals.length} Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Instant 0ms navigation powered by live WebSocket stream
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-400" />
        </Link>

        <Link
          href="/walls"
          className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-[#0B101B] to-emerald-950/20 px-4 py-3 transition-all hover:border-emerald-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 sm:text-sm">
                  Open Live Bid Walls Radar
                </h3>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  {walls.length} Live Walls
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time L2 whale clusters & order book depth imbalance
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-400" />
        </Link>
      </div>
    </main>
  );
}
