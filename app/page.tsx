// app/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { Signal, SignalStats, BidWall } from "@/types/types";
import {
  RefreshCw,
  Zap,
  Shield,
  ArrowUpRight,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 7000;

const FALLBACK_SIGNALS: Signal[] = [
  {
    id: 101,
    symbol: "FHE",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 84,
    p1_volume_score: 17,
    p2_wall_score: 23,
    p3_structure_score: 34,
    p4_btc_score: 10,
    entry_low: 0.0187811,
    entry_high: 0.0189282,
    stop_loss: 0.0184644,
    tp1_price: 0.019624,
    tp2_price: 0.0200879,
    volume_ratio: 2.2,
    taker_buy_ratio: 0.7,
    is_extended: false,
    detected_at: "2026-10-30T10:45:00.000Z",
    smc_bos: true,
    smc_ob: false,
  },
  {
    id: 102,
    symbol: "PHAROS",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 96,
    p1_volume_score: 25,
    p2_wall_score: 25,
    p3_structure_score: 36,
    p4_btc_score: 10,
    entry_low: 0.632863,
    entry_high: 0.634166,
    stop_loss: 0.617849,
    tp1_price: 0.658641,
    tp2_price: 0.674957,
    volume_ratio: 6.4,
    taker_buy_ratio: 0.78,
    is_extended: false,
    detected_at: "2026-10-30T10:38:00.000Z",
    smc_bos: true,
    smc_ob: true,
  },
];

const FALLBACK_STATS: SignalStats = {
  total_signals: 144,
  finalized: 131,
  win_rate_pct: 36.6,
  wall_backed_win_rate_pct: 34.2,
  tp1_rate_pct: 16.8,
  tp2_rate_pct: 10.7,
  breakeven_rate_pct: 28.2,
  sl_rate_pct: 40.5,
  avg_max_gain_pct: 2.89,
  avg_max_drawdown_pct: -1.58,
};

export default function DashboardOverviewPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [wallsCount, setWallsCount] = useState<number>(18);

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [startOfDay, setStartOfDay] = useState<Date | null>(null);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStartOfDay(now);
  }, []);

  const fetchOverviewData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      const [sigRes, statsRes, wallsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/signals`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/signals/stats`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/walls/active`, { cache: "no-store" }),
      ]);

      if (!sigRes.ok || !statsRes.ok || !wallsRes.ok) {
        throw new Error("API Offline");
      }

      const [sigData, statsData, wallsData] = await Promise.all([
        sigRes.json(),
        statsRes.json(),
        wallsRes.json(),
      ]);

      const parsedSignals: Signal[] = Array.isArray(sigData)
        ? sigData
        : sigData.signals || [];
      const parsedWalls: BidWall[] = Array.isArray(wallsData)
        ? wallsData
        : wallsData.walls || [];

      startTransition(() => {
        setSignals(parsedSignals);
        setStats(statsData);
        setWallsCount(parsedWalls.length);
      });
    } catch {
      startTransition(() => {
        setSignals((prev) => (prev.length > 0 ? prev : FALLBACK_SIGNALS));
        setStats((prev) => prev || FALLBACK_STATS);
      });
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData(false);
    const timer = setInterval(() => {
      fetchOverviewData(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchOverviewData]);

  const signalsTodayCount = useMemo(() => {
    if (!startOfDay) return signals.length;
    const count = signals.filter((s) =>
      s.detected_at ? new Date(s.detected_at) >= startOfDay : true
    ).length;
    return count || signals.length;
  }, [signals, startOfDay]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6">
      {/* Section 1: Sleek Top 4 KPI Cards */}
      <StatsCards
        stats={stats}
        signalsTodayCount={signalsTodayCount}
        activeCoinsCount={wallsCount + signals.length || 293}
        isLoading={isInitialLoading}
      />

      {/* Section 2: 2 Big Analytics Charts + Pattern/TF Breakdown */}
      <AnalyticsCharts
        signals={signals}
        stats={stats}
        isLoading={isInitialLoading}
      />

      {/* Section 3: Compact Quick-Access Bar for Signals & Live Walls */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Link
          href="/signals"
          className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-[#0B101B] to-cyan-950/20 px-4 py-3 transition-all hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.12)]"
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
                Inspect live breakout cards, SMC Order Blocks & TradingView charts
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-cyan-400" />
        </Link>

        <Link
          href="/walls"
          className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-[#0B101B] to-emerald-950/20 px-4 py-3 transition-all hover:border-emerald-500/50 hover:shadow-[0_0_25px_rgba(16,185,129,0.12)]"
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
                  {wallsCount} Live Walls
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Track $50K+ whale bid clusters, respect rates & L2 depth imbalance
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-400" />
        </Link>
      </div>

      {/* Mobile Floating Refresh Button */}
      <button
        onClick={() => fetchOverviewData(true)}
        aria-label="Refresh Data"
        className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.5)] transition active:scale-90 md:hidden"
      >
        <RefreshCw
          className={`h-4 w-4 ${isRefreshing || isPending ? "animate-spin" : ""}`}
        />
      </button>
    </main>
  );
}