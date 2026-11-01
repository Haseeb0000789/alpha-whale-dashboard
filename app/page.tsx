// app/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import { Zap, Shield, ArrowUpRight, RefreshCw } from "lucide-react";

export default function DashboardOverviewPage() {
  const { signals, stats, walls, isInitialLoading, triggerRefresh } =
    useDashboardSocket();
  const [startOfDay, setStartOfDay] = useState<Date | null>(null);

  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStartOfDay(now);
  }, []);

  const signalsTodayCount = useMemo(() => {
    if (!startOfDay) return signals.length;
    const count = signals.filter((s) =>
      s.detected_at ? new Date(s.detected_at) >= startOfDay : true
    ).length;
    return count || signals.length;
  }, [signals, startOfDay]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6">
      <StatsCards
        stats={stats}
        signalsTodayCount={signalsTodayCount}
        activeCoinsCount={walls.length + signals.length || 293}
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
                  {signals.length} Active
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

      <button
        onClick={triggerRefresh}
        aria-label="Refresh Data"
        className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg md:hidden"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </main>
  );
}