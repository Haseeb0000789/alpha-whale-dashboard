// app/signals/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import { exportToCSV } from "@/components/SignalTable";
import {
  Signal,
  SignalOutcomeStatus,
  TimeframeFilter,
  formatCryptoPrice,
  formatPatternName,
  formatRelativeTime,
  getSyncedNowMs,
  parseUtcTimestampMs,
} from "@/types/types";
import {
  Search,
  Filter,
  SlidersHorizontal,
  Download,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  Cpu,
  ArrowUpDown,
  Zap,
  Trophy,
  ShieldCheck,
  XCircle,
  Clock,
  Flame,
  Gem,
  TrendingUp,
} from "lucide-react";

const TIMEFRAMES: TimeframeFilter[] = ["ALL", "15m", "1h", "4h", "1d"];

const PATTERN_OPTIONS = [
  { value: "ALL", label: "All Patterns" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "cup_and_handle", label: "Cup & Handle" },
  { value: "inverse_head_shoulders", label: "Inverse H&S" },
  { value: "ascending_triangle", label: "Ascending Triangle" },
  { value: "bullish_pennant", label: "Bullish Pennant" },
  { value: "bullish_flag", label: "Bullish Flag" },
  { value: "descending_trendline", label: "Descending Trendline" },
  { value: "horizontal_resistance", label: "Horizontal Resistance" },
  { value: "vwap_ema_pullback", label: "VWAP / EMA Pullback (Scalp)" },
  { value: "liquidity_sweep_breakout", label: "Liquidity Sweep Breakout" },
  { value: "order_block_bounce", label: "Order Block Bounce" },
  { value: "institutional_reaccumulation", label: "Institutional Re-Accumulation" },
];

type MarketTab = "ALPHA" | "SPOT";
type SpotStyleFilter = "ALL" | "SCALP" | "SWING";
type SortMode = "relevance" | "confidence" | "time";
type OutcomeFilter = "ALL" | "IN_PLAY" | "TP_HIT" | "BREAKEVEN" | "SL_HIT";

function formatSafeRelativeTime(isoDate: string | undefined, nowMs: number): string {
  if (!isoDate || nowMs <= 0) return "Live now";
  return formatRelativeTime(isoDate, nowMs);
}

function ScoreCircleBadge({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;
  const strokeColor =
    clamped >= 80 ? "#10b981" : clamped >= 68 ? "#06b6d4" : "#f59e0b";

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="h-12 w-12 -rotate-90 transform" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
          fill="transparent"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <span className="absolute font-mono text-xs font-black text-white">
        {clamped.toFixed(0)}
      </span>
    </div>
  );
}

function OutcomeStatusBadge({ sig }: { sig: Signal }) {
  const status: SignalOutcomeStatus = sig.outcome_status || "IN_PLAY";
  const maxGain = sig.max_gain_pct ?? 0;
  const maxDd = sig.max_drawdown_pct ?? 0;

  if (status === "TP2_HIT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
        <Trophy className="h-3 w-3 text-emerald-400" />
        🚀 TP2 Hit {maxGain > 0 ? `(+${maxGain.toFixed(1)}%)` : ""}
      </span>
    );
  }

  if (status === "TP1_HIT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        🎯 TP1 Hit {maxGain > 0 ? `(+${maxGain.toFixed(1)}%)` : ""}
      </span>
    );
  }

  if (status === "BREAKEVEN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
        <ShieldCheck className="h-3 w-3 text-cyan-400" />
        🛡️ Breakeven {maxGain > 0 ? `(Peak +${maxGain.toFixed(1)}%)` : ""}
      </span>
    );
  }

  if (status === "SL_HIT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-rose-300">
        <XCircle className="h-3 w-3 text-rose-400" />
        🛑 SL Hit {maxDd < 0 ? `(${maxDd.toFixed(1)}%)` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
      <Clock className="h-3 w-3 text-amber-400" />
      ⏳ In-Play {maxGain > 0 ? `(+${maxGain.toFixed(1)}% MFE)` : ""}
    </span>
  );
}

export default function SignalsGridPage() {
  const router = useRouter();
  const {
    signals,
    spotSignals: wsSpotSignals,
    settings,
    isInitialLoading,
    triggerRefresh,
  } = useDashboardSocket();
  const [nowMs, setNowMs] = useState<number>(0);

  // Market Switcher Tab: "ALPHA" (Binance Alpha) vs "SPOT" (Main CEX Spot Scalp & Swing)
  const [marketTab, setMarketTab] = useState<MarketTab>("ALPHA");
  const [spotStyleFilter, setSpotStyleFilter] = useState<SpotStyleFilter>("ALL");

  const [selectedTf, setSelectedTf] = useState<TimeframeFilter>("ALL");
  const [selectedPattern, setSelectedPattern] = useState<string>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  const [customMinScore, setCustomMinScore] = useState<number | null>(null);
  const minScore = customMinScore ?? (settings?.min_score ?? 65);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyReady, setOnlyReady] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");

  // Always show authentic live Spot signals — never inject hardcoded fake trade setups
  const activeSpotPool = useMemo(() => wsSpotSignals ?? [], [wsSpotSignals]);
  const rawDataset = marketTab === "ALPHA" ? signals : activeSpotPool;

  // Enforce Control Panel Active Strategy Filters (enabled_timeframes & enabled_patterns) case-insensitively in 0ms
  const baseDataset = useMemo(() => {
    const rawTfs = settings?.enabled_timeframes;
    const rawPats = settings?.enabled_patterns;
    const enabledTfs = Array.isArray(rawTfs)
      ? new Set(rawTfs.map((t) => String(t).trim().toLowerCase()))
      : null;
    const enabledPats = Array.isArray(rawPats)
      ? new Set(rawPats.map((p) => String(p).trim().toLowerCase()))
      : null;
    return rawDataset.filter((s) => {
      const tf = String(s.timeframe || "").trim().toLowerCase();
      const pat = String(s.structure || "").trim().toLowerCase();
      if (enabledTfs && !enabledTfs.has(tf)) {
        return false;
      }
      if (enabledPats && !enabledPats.has(pat)) {
        return false;
      }
      return true;
    });
  }, [rawDataset, settings]);

  // Update relative-time clock on mount + when signals arrive + 30s interval
  useEffect(() => {
    const initId = setTimeout(() => setNowMs(getSyncedNowMs()), 0);
    const id = setInterval(() => setNowMs(getSyncedNowMs()), 30000);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, [rawDataset.length]);

  const outcomeCounts = useMemo(() => {
    let inPlay = 0;
    let tpHit = 0;
    let tp2Hit = 0;
    let breakeven = 0;
    let slHit = 0;
    let scalpCount = 0;
    let swingCount = 0;

    for (const s of baseDataset) {
      const st = s.outcome_status || "IN_PLAY";
      if (st === "TP2_HIT") {
        tpHit++;
        tp2Hit++;
      } else if (st === "TP1_HIT") {
        tpHit++;
      } else if (st === "BREAKEVEN") {
        breakeven++;
      } else if (st === "SL_HIT") {
        slHit++;
      } else {
        inPlay++;
      }

      if (s.trade_style === "SWING" || s.timeframe === "4h" || s.timeframe === "1d") {
        swingCount++;
      } else {
        scalpCount++;
      }
    }

    return {
      total: baseDataset.length,
      inPlay,
      tpHit,
      tp2Hit,
      breakeven,
      slHit,
      scalpCount,
      swingCount,
    };
  }, [baseDataset]);

  const filteredSignals = useMemo(() => {
    if (baseDataset.length === 0) return [];

    const list = baseDataset.filter((sig) => {
      const cleanSym = sig.symbol.trim().toUpperCase();
      if (onlyReady && sig.is_extended) return false;

      if (marketTab === "SPOT" && spotStyleFilter !== "ALL") {
        const style =
          sig.trade_style ||
          (sig.timeframe === "4h" || sig.timeframe === "1d" ? "SWING" : "SCALP");
        if (style !== spotStyleFilter) return false;
      }

      const st = sig.outcome_status || "IN_PLAY";
      if (outcomeFilter === "IN_PLAY" && st !== "IN_PLAY") return false;
      if (
        outcomeFilter === "TP_HIT" &&
        st !== "TP1_HIT" &&
        st !== "TP2_HIT"
      ) {
        return false;
      }
      if (outcomeFilter === "BREAKEVEN" && st !== "BREAKEVEN") return false;
      if (outcomeFilter === "SL_HIT" && st !== "SL_HIT") return false;

      const matchesTf =
        selectedTf === "ALL" ||
        sig.timeframe.toLowerCase() === selectedTf.toLowerCase();
      const matchesPattern =
        selectedPattern === "ALL" ||
        sig.structure.toLowerCase() === selectedPattern.toLowerCase();
      const matchesScore = sig.confidence >= minScore;
      const matchesSearch =
        !searchQuery.trim() ||
        cleanSym.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        sig.structure.toLowerCase().includes(searchQuery.trim().toLowerCase());

      return matchesTf && matchesPattern && matchesScore && matchesSearch;
    });

    return [...list].sort((a, b) => {
      const symA = a.symbol.trim().toUpperCase();
      const symB = b.symbol.trim().toUpperCase();
      const timeA = parseUtcTimestampMs(a.detected_at) || 0;
      const timeB = parseUtcTimestampMs(b.detected_at) || 0;

      if (sortMode === "relevance") {
        const refNow = Math.max(nowMs, getSyncedNowMs(), timeA, timeB);
        const ageHoursA = Math.max(0, (refNow - timeA) / 3600000);
        const ageHoursB = Math.max(0, (refNow - timeB) / 3600000);

        const freshScoreA = Math.max(0, 45 - ageHoursA * 4.5);
        const freshScoreB = Math.max(0, 45 - ageHoursB * 4.5);

        const readyBonusA = a.is_extended ? 0 : 25;
        const readyBonusB = b.is_extended ? 0 : 25;

        const wallBonusA = (a.p2_wall_score ?? 0) > 0 ? 15 : 0;
        const wallBonusB = (b.p2_wall_score ?? 0) > 0 ? 15 : 0;

        const rsBonusA = Math.max(0, (a.rs_vs_btc ?? 0) * 2.5);
        const rsBonusB = Math.max(0, (b.rs_vs_btc ?? 0) * 2.5);

        const activeBonusA =
          (a.outcome_status || "IN_PLAY") === "IN_PLAY" ? 20 : 0;
        const activeBonusB =
          (b.outcome_status || "IN_PLAY") === "IN_PLAY" ? 20 : 0;

        const totalA =
          Math.round(
            (a.confidence +
              freshScoreA +
              readyBonusA +
              wallBonusA +
              rsBonusA +
              activeBonusA) /
              2
          ) * 2;
        const totalB =
          Math.round(
            (b.confidence +
              freshScoreB +
              readyBonusB +
              wallBonusB +
              rsBonusB +
              activeBonusB) /
              2
          ) * 2;

        if (totalB !== totalA) return totalB - totalA;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return symA.localeCompare(symB);
      }

      if (sortMode === "confidence") {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (timeB !== timeA) return timeB - timeA;
        return symA.localeCompare(symB);
      }

      const bucketA = Math.floor(timeA / 120000);
      const bucketB = Math.floor(timeB / 120000);
      if (bucketB !== bucketA) return bucketB - bucketA;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return symA.localeCompare(symB);
    });
  }, [
    baseDataset,
    marketTab,
    spotStyleFilter,
    nowMs,
    selectedTf,
    selectedPattern,
    outcomeFilter,
    minScore,
    searchQuery,
    onlyReady,
    sortMode,
  ]);

  const resetAllFilters = () => {
    setSelectedTf("ALL");
    setSelectedPattern("ALL");
    setOutcomeFilter("ALL");
    setSpotStyleFilter("ALL");
    setOnlyReady(false);
    setSearchQuery("");
    setCustomMinScore(null);
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6 pb-32 md:pb-24">
      {/* 0. MARKET ENGINE SWITCHER TABS: Binance Alpha vs Main CEX Spot (Scalp & Swing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-2 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab 1: Binance Alpha Signals */}
          <button
            onClick={() => {
              setMarketTab("ALPHA");
              setOutcomeFilter("ALL");
              setSpotStyleFilter("ALL");
              if (
                selectedPattern !== "ALL" &&
                !signals.some(
                  (s) =>
                    String(s.structure || "").toLowerCase() ===
                    selectedPattern.toLowerCase()
                )
              ) {
                setSelectedPattern("ALL");
              }
            }}
            className={`relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-black tracking-wide transition-all sm:text-sm ${
              marketTab === "ALPHA"
                ? "border border-cyan-500/50 bg-gradient-to-r from-cyan-500/20 via-emerald-500/15 to-blue-500/20 text-white shadow-[0_0_25px_rgba(6,182,212,0.2)]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Flame
              className={`h-4 w-4 ${
                marketTab === "ALPHA" ? "text-cyan-400" : "text-slate-500"
              }`}
            />
            <span>Binance Alpha Breakouts</span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
              {signals.length}
            </span>
          </button>

          {/* Tab 2: Main CEX Spot Signals (Scalp + Swing Quant Engine) */}
          <button
            onClick={() => {
              setMarketTab("SPOT");
              setOutcomeFilter("ALL");
              setSpotStyleFilter("ALL");
              if (selectedTf === "1d") {
                setSelectedTf("ALL");
              }
              if (
                selectedPattern !== "ALL" &&
                !activeSpotPool.some(
                  (s) =>
                    String(s.structure || "").toLowerCase() ===
                    selectedPattern.toLowerCase()
                )
              ) {
                setSelectedPattern("ALL");
              }
              if (activeSpotPool.length === 0) {
                triggerRefresh();
              }
            }}
            className={`relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-black tracking-wide transition-all sm:text-sm ${
              marketTab === "SPOT"
                ? "border border-emerald-500/50 bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-cyan-500/20 text-white shadow-[0_0_25px_rgba(16,185,129,0.25)]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Gem
              className={`h-4 w-4 ${
                marketTab === "SPOT" ? "text-emerald-400" : "text-slate-500"
              }`}
            />
            <span>Main CEX Spot (Scalp & Swing)</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
              {activeSpotPool.length} Live
            </span>
          </button>
        </div>

        {/* Sub-Mode Pills when SPOT Tab is active (Scalp vs Swing) */}
        {marketTab === "SPOT" ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-[#07090E]/90 p-1 text-xs">
            <button
              onClick={() => setSpotStyleFilter("ALL")}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                spotStyleFilter === "ALL"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Spot ({outcomeCounts.total})
            </button>
            <button
              onClick={() => setSpotStyleFilter("SCALP")}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                spotStyleFilter === "SCALP"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ⚡ Momentum Scalps 15m/1h ({outcomeCounts.scalpCount})
            </button>
            <button
              onClick={() => setSpotStyleFilter("SWING")}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                spotStyleFilter === "SWING"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🌊 RS Swing Setups 4h ({outcomeCounts.swingCount})
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-2 pr-2 text-xs text-slate-400 xl:flex">
            <span>Engine:</span>
            <strong className="text-cyan-300">
              4-Pillar On-Chain & Alpha Liquidity Scanner
            </strong>
          </div>
        )}
      </div>

      {/* 1. TOP 5 OUTCOME FILTER BOXES */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <button
          onClick={() => setOutcomeFilter("ALL")}
          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
            outcomeFilter === "ALL"
              ? "border-cyan-500/50 bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
              : "border-slate-800/90 bg-slate-900/60 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {marketTab === "SPOT" ? "Total Spot Setups" : "Total Signals (7D)"}
            </span>
            <span className="font-mono text-xl font-black text-white">
              {outcomeCounts.total}
            </span>
          </div>
          <Cpu className="h-4 w-4 text-cyan-400" />
        </button>

        <button
          onClick={() => setOutcomeFilter("IN_PLAY")}
          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
            outcomeFilter === "IN_PLAY"
              ? "border-amber-500/50 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
              : "border-slate-800/90 bg-slate-900/60 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
              ⏳ Live In-Play
            </span>
            <span className="font-mono text-xl font-black text-amber-400">
              {outcomeCounts.inPlay}
            </span>
          </div>
          <Clock className="h-4 w-4 text-amber-400" />
        </button>

        <button
          onClick={() => setOutcomeFilter("TP_HIT")}
          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
            outcomeFilter === "TP_HIT"
              ? "border-emerald-500/50 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              : "border-slate-800/90 bg-slate-900/60 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">
              🎯 TP1 / TP2 Hit
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-black text-emerald-400">
                {outcomeCounts.tpHit}
              </span>
              <span className="font-mono text-[10px] text-emerald-300/80">
                (TP2: {outcomeCounts.tp2Hit})
              </span>
            </div>
          </div>
          <Trophy className="h-4 w-4 text-emerald-400" />
        </button>

        <button
          onClick={() => setOutcomeFilter("BREAKEVEN")}
          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
            outcomeFilter === "BREAKEVEN"
              ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
              : "border-slate-800/90 bg-slate-900/60 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-300/90">
              🛡️ Breakeven Exit
            </span>
            <span className="font-mono text-xl font-black text-cyan-400">
              {outcomeCounts.breakeven}
            </span>
          </div>
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
        </button>

        <button
          onClick={() => setOutcomeFilter("SL_HIT")}
          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
            outcomeFilter === "SL_HIT"
              ? "border-rose-500/50 bg-rose-500/15 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
              : "border-slate-800/90 bg-slate-900/60 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-300/90">
              🛑 Stopped Out (-SL)
            </span>
            <span className="font-mono text-xl font-black text-rose-400">
              {outcomeCounts.slHit}
            </span>
          </div>
          <XCircle className="h-4 w-4 text-rose-400" />
        </button>
      </div>

      {/* 2. FILTER & SORT BAR */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold text-white sm:text-base">
              Showing {filteredSignals.length} of {baseDataset.length}{" "}
              {marketTab === "SPOT" ? "Main Spot Setups" : "Alpha Signals"}
            </h1>
            {outcomeFilter !== "ALL" && (
              <button
                onClick={() => setOutcomeFilter("ALL")}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
              >
                Clear Outcome Filter ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. SOL, SUI, TAO)..."
                className="w-full sm:w-52 rounded-xl border border-slate-700/60 bg-[#07090E]/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            <button
              onClick={() => exportToCSV(filteredSignals)}
              disabled={filteredSignals.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-slate-700/60 bg-[#07090E]/90 p-1">
              <Filter className="ml-2 mr-1 h-3.5 w-3.5 text-slate-400" />
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTf(tf)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    selectedTf === tf
                      ? "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort on LEFT, Ready Only + Min Score + Pattern on RIGHT */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 text-slate-400">
              <ArrowUpDown className="h-3.5 w-3.5 text-cyan-400" /> Sort:
            </span>
            <button
              onClick={() => setSortMode("relevance")}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                sortMode === "relevance"
                  ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🔥 Most Relevant
            </button>
            <button
              onClick={() => setSortMode("confidence")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                sortMode === "confidence"
                  ? "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Highest Score
            </button>
            <button
              onClick={() => setSortMode("time")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                sortMode === "time"
                  ? "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Newest First
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setOnlyReady(!onlyReady)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 font-semibold transition ${
                onlyReady
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-700/60 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ready Only</span>
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-slate-400">Min Score:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setCustomMinScore(Number(e.target.value))}
                className="h-1.5 w-24 sm:w-28 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
              />
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                {minScore}+
              </span>
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-slate-400">Pattern:</span>
              <select
                value={selectedPattern}
                onChange={(e) => setSelectedPattern(e.target.value)}
                className="rounded-lg border border-slate-700/60 bg-[#0D121D] px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none"
              >
                {PATTERN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SIGNAL CARDS GRID */}
      <div className="min-h-[520px]">
        {isInitialLoading && baseDataset.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-60 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5"
              />
            ))}
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/50 px-6 py-16 text-center backdrop-blur-xl">
            <Cpu className="mb-3 h-10 w-10 text-cyan-400/60" />
            <h3 className="text-sm font-bold text-white sm:text-base">
              {baseDataset.length === 0
                ? marketTab === "SPOT"
                  ? "Scanning Main CEX Spot Universe for High-Conviction Setups"
                  : "Waiting for Live 4-Pillar Alpha Breakouts"
                : "No Signals Match Current Filter Criteria"}
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-slate-400">
              {baseDataset.length === 0
                ? `Strict institutional gates (Min Score ${minScore}+, closed-bar RVOL, Taker Buy flow & L2 Bid Wall support) are active. Only verified live setups appear here.`
                : `0 of ${baseDataset.length} active setups match your selected timeframe, pattern, outcome, or ${minScore}+ score filters.`}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {baseDataset.length > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/25"
                >
                  Reset Filters
                </button>
              )}
              <button
                onClick={triggerRefresh}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Live Stream</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {filteredSignals.map((sig, idx) => {
                const cleanSym = (sig.symbol || "").trim().toUpperCase();
                const stableKey =
                  marketTab === "SPOT"
                    ? `SPOT-${cleanSym}-${sig.timeframe}`
                    : sig.id
                    ? `ALPHA-${sig.id}`
                    : `ALPHA-${cleanSym}-${sig.timeframe}-${sig.detected_at || idx}`;

                const rawEntry =
                  Number(sig.entry_high) ||
                  Number(sig.breakout_price) ||
                  Number(sig.entry_low) ||
                  Number(sig.level_price) ||
                  0;
                const entryVal = rawEntry > 0 ? rawEntry : undefined;
                const stopLossVal =
                  Number(sig.stop_loss) > 0
                    ? Number(sig.stop_loss)
                    : entryVal
                    ? entryVal * 0.985
                    : undefined;
                const tp1Val =
                  Number(sig.tp1_price) > 0
                    ? Number(sig.tp1_price)
                    : entryVal
                    ? entryVal * 1.0185
                    : undefined;
                const tp2Val =
                  Number(sig.tp2_price) > 0
                    ? Number(sig.tp2_price)
                    : entryVal
                    ? entryVal * 1.036
                    : undefined;

                const effectiveNowMs = Math.max(nowMs, getSyncedNowMs());
                const sigTimeMs = parseUtcTimestampMs(sig.detected_at);
                const sigAgeMs = !isNaN(sigTimeMs) ? effectiveNowMs - sigTimeMs : Infinity;
                const isStillInPlay =
                  (sig.outcome_status || "IN_PLAY") === "IN_PLAY" &&
                  !sig.outcome_finalized;
                const isFresh =
                  nowMs > 0 &&
                  isStillInPlay &&
                  sigAgeMs >= 0 &&
                  sigAgeMs < 3600000;

                const isSpotCard = marketTab === "SPOT" || sig.market_type === "SPOT";
                const tradeStyle =
                  sig.trade_style ||
                  (sig.timeframe === "4h" || sig.timeframe === "1d"
                    ? "SWING"
                    : "SCALP");

                const tp1Pct =
                  entryVal && tp1Val
                    ? (((tp1Val - entryVal) / entryVal) * 100).toFixed(1)
                    : "1.8";

                return (
                  <motion.div
                    key={stableKey}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    onClick={() =>
                      router.push(`/coin/${encodeURIComponent(cleanSym)}`)
                    }
                    className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 shadow-lg backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] ${
                      sig.outcome_status === "TP1_HIT" ||
                      sig.outcome_status === "TP2_HIT"
                        ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.08] via-slate-900/90 to-[#0A0E17] hover:border-emerald-400/70"
                        : sig.outcome_status === "SL_HIT"
                        ? "border-rose-500/30 bg-gradient-to-b from-rose-500/[0.05] via-slate-900/90 to-[#0A0E17] hover:border-rose-400/50"
                        : "border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-[#0A0E17] hover:border-cyan-500/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xl font-black tracking-tight text-white group-hover:text-cyan-300">
                            <span>{cleanSym}</span>
                            <ArrowUpRight className="h-4 w-4 text-cyan-400" />
                          </span>
                          <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                            {sig.timeframe}
                          </span>

                          {/* Scalp vs Swing Badge for Spot Tab */}
                          {isSpotCard && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                                tradeStyle === "SCALP"
                                  ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-300"
                                  : "border-purple-400/40 bg-purple-500/20 text-purple-300"
                              }`}
                            >
                              {tradeStyle === "SCALP" ? "⚡ SCALP" : "🌊 SWING"}
                            </span>
                          )}

                          {isFresh && !sig.is_extended && !isSpotCard && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              <Zap className="h-2.5 w-2.5" /> Fresh
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span>
                            {formatSafeRelativeTime(sig.detected_at, nowMs)}
                          </span>
                          <span>•</span>
                          <OutcomeStatusBadge sig={sig} />
                        </div>
                      </div>

                      <ScoreCircleBadge score={sig.confidence} />
                    </div>

                    <div className="my-3.5 space-y-2.5 border-y border-white/[0.06] py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {isSpotCard ? "Quant Trigger" : "Structure"}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {formatPatternName(sig.structure)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                          Vol {(sig.volume_ratio ?? 2.1).toFixed(1)}x
                        </span>

                        {sig.taker_buy_ratio && (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                            Buy Flow {Math.round(sig.taker_buy_ratio * 100)}%
                          </span>
                        )}

                        {sig.rs_vs_btc !== undefined && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${
                              sig.rs_vs_btc >= 0
                                ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                                : "border-slate-700 bg-slate-800 text-slate-400"
                            }`}
                          >
                            <TrendingUp className="h-2.5 w-2.5" />
                            RS {sig.rs_vs_btc >= 0 ? "+" : ""}
                            {sig.rs_vs_btc.toFixed(1)}% vs BTC
                          </span>
                        )}

                        {sig.smc_bos && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                            <Sparkles className="h-2.5 w-2.5" /> SMC BoS
                          </span>
                        )}

                        {sig.smc_ob && (
                          <span className="rounded-md border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                            📦 OB Zone
                          </span>
                        )}

                        {sig.is_extended ? (
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            ⚠️ Extended
                          </span>
                        ) : (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            ✅ Ready Entry
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="min-w-0 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-2.5 text-center">
                        <span className="block truncate text-[10px] font-semibold uppercase text-cyan-300/80">
                          Entry
                        </span>
                        <span
                          className="mt-0.5 block truncate font-mono text-xs font-bold text-white"
                          title={`$${formatCryptoPrice(entryVal)}`}
                        >
                          ${formatCryptoPrice(entryVal)}
                        </span>
                      </div>
                      <div className="min-w-0 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-2.5 text-center">
                        <span className="block truncate text-[10px] font-semibold uppercase text-rose-300/80">
                          Stop Loss
                        </span>
                        <span
                          className="mt-0.5 block truncate font-mono text-xs font-bold text-rose-400"
                          title={`$${formatCryptoPrice(stopLossVal)}`}
                        >
                          ${formatCryptoPrice(stopLossVal)}
                        </span>
                      </div>
                      <div className="min-w-0 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-2.5 text-center">
                        <span className="block truncate text-[10px] font-semibold uppercase text-emerald-300/80">
                          TP1 (+{tp1Pct}%)
                        </span>
                        <span
                          className="mt-0.5 block truncate font-mono text-xs font-bold text-emerald-400"
                          title={`TP1: $${formatCryptoPrice(tp1Val)} | TP2: $${formatCryptoPrice(tp2Val)}`}
                        >
                          ${formatCryptoPrice(tp1Val)}
                        </span>
                        {tp2Val !== undefined && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] font-medium text-emerald-300/75">
                            TP2: ${formatCryptoPrice(tp2Val)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}
