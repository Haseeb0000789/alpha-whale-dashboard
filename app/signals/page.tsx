// app/signals/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import { exportToCSV, SignalCard } from "@/components/SignalTable";
import {
  TimeframeFilter,
  getSyncedNowMs,
  parseUtcTimestampMs,
} from "@/types/types";
import {
  Search,
  Filter,
  SlidersHorizontal,
  Download,
  RefreshCw,
  ArrowUpDown,
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

  const activeSpotPool = useMemo(() => wsSpotSignals ?? [], [wsSpotSignals]);
  const rawDataset = marketTab === "ALPHA" ? signals : activeSpotPool;

  // Enforce Control Panel Active Strategy Filters case-insensitively in 0ms
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
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-3 sm:px-6 pb-24">
      {/* 1. TOP BAR: Sleek Segmented Control (Binance Spot/Futures style) + Outcome Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2B3139] pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Control */}
          <div className="inline-flex items-center rounded-lg border border-[#2B3139] bg-[#161A1E] p-0.5">
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
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                marketTab === "ALPHA"
                  ? "bg-[#2B3139] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Binance Alpha Breakouts</span>
              <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono text-[10px] text-slate-300">
                {signals.length}
              </span>
            </button>

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
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                marketTab === "SPOT"
                  ? "bg-[#2B3139] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Main CEX Spot</span>
              <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono text-[10px] text-slate-300">
                {activeSpotPool.length}
              </span>
            </button>
          </div>

          {/* Sub-segmented control when Spot tab is active */}
          {marketTab === "SPOT" && (
            <div className="inline-flex items-center rounded-lg border border-[#2B3139] bg-[#161A1E] p-0.5 text-[11px]">
              <button
                onClick={() => setSpotStyleFilter("ALL")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  spotStyleFilter === "ALL"
                    ? "bg-[#2B3139] text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({outcomeCounts.total})
              </button>
              <button
                onClick={() => setSpotStyleFilter("SCALP")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  spotStyleFilter === "SCALP"
                    ? "bg-[#2B3139] text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Scalp ({outcomeCounts.scalpCount})
              </button>
              <button
                onClick={() => setSpotStyleFilter("SWING")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  spotStyleFilter === "SWING"
                    ? "bg-[#2B3139] text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Swing ({outcomeCounts.swingCount})
              </button>
            </div>
          )}
        </div>

        {/* Compact Outcome Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ["ALL", "All", outcomeCounts.total],
              ["IN_PLAY", "In-Play", outcomeCounts.inPlay],
              ["TP_HIT", "TP Hit", outcomeCounts.tpHit],
              ["BREAKEVEN", "Breakeven", outcomeCounts.breakeven],
              ["SL_HIT", "SL Hit", outcomeCounts.slHit],
            ] as [OutcomeFilter, string, number][]
          ).map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setOutcomeFilter(val)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                outcomeFilter === val
                  ? "border-white/25 bg-[#2B3139] text-white"
                  : "border-white/10 bg-[#121418] text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <span>{label}</span>
              <span className="font-mono font-bold text-slate-200">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. COMPACT FILTER & SORT TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[#2B3139] bg-[#121418] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol..."
              className="w-36 rounded-md border border-white/10 bg-[#0B0E11] py-1 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 focus:border-white/25 focus:outline-none sm:w-44"
            />
          </div>

          <div className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0B0E11] p-0.5">
            <Filter className="ml-1.5 mr-1 h-3 w-3 text-slate-500" />
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  selectedTf === tf
                    ? "bg-[#2B3139] text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="rounded-md border border-white/10 bg-[#0B0E11] px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              {PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0B0E11] p-0.5">
            <ArrowUpDown className="ml-1.5 mr-1 h-3 w-3 text-slate-500" />
            {(
              [
                ["relevance", "Relevant"],
                ["confidence", "Score"],
                ["time", "Newest"],
              ] as [SortMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  sortMode === mode
                    ? "bg-[#2B3139] text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOnlyReady(!onlyReady)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              onlyReady
                ? "border-white/25 bg-[#2B3139] text-white"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            Ready Only
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Min</span>
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setCustomMinScore(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer appearance-none rounded bg-slate-800 accent-slate-300"
            />
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
              {minScore}+
            </span>
          </div>

          <button
            onClick={() => exportToCSV(filteredSignals)}
            disabled={filteredSignals.length === 0}
            title="Export CSV"
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* 3. SIGNAL CARDS GRID */}
      <div className="min-h-[480px]">
        {isInitialLoading && baseDataset.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-44 animate-pulse rounded-lg border border-white/10 bg-[#121418] p-4"
              />
            ))}
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-[#121418] px-6 py-14 text-center">
            <h3 className="text-sm font-bold text-white">
              {baseDataset.length === 0
                ? marketTab === "SPOT"
                  ? "Scanning Main CEX Spot Universe"
                  : "Waiting for Live Alpha Breakouts"
                : "No Signals Match Current Filters"}
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              {baseDataset.length === 0
                ? `Min score ${minScore}+ and active strategy filters are enforced.`
                : `0 of ${baseDataset.length} active setups match your current filter selection.`}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {baseDataset.length > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Reset Filters
                </button>
              )}
              <button
                onClick={triggerRefresh}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {filteredSignals.map((sig, idx) => {
                const cleanSym = (sig.symbol || "").trim().toUpperCase();
                const stableKey =
                  marketTab === "SPOT"
                    ? `SPOT-${cleanSym}-${sig.timeframe}`
                    : sig.id
                    ? `ALPHA-${sig.id}`
                    : `ALPHA-${cleanSym}-${sig.timeframe}-${sig.detected_at || idx}`;

                return (
                  <SignalCard
                    key={stableKey}
                    sig={sig}
                    nowMs={nowMs}
                    isSpotCard={marketTab === "SPOT" || sig.market_type === "SPOT"}
                    onClick={() =>
                      router.push(`/coin/${encodeURIComponent(cleanSym)}`)
                    }
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}
