// app/signals/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import { exportToCSV } from "@/components/SignalTable";
import {
  TimeframeFilter,
  formatCryptoPrice,
  formatPatternName,
} from "@/types/types";
import {
  Search,
  Filter,
  SlidersHorizontal,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  Cpu,
  ArrowUpDown,
  Zap,
} from "lucide-react";

const TIMEFRAMES: TimeframeFilter[] = ["ALL", "15m", "1h", "4h", "1d"];

// NEW: Outcome filter type (was referenced but never defined)
type OutcomeFilter = "ALL" | "PENDING" | "TP_HIT" | "SL_HIT";

const PATTERN_OPTIONS = [
  { value: "ALL", label: "All Patterns" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "cup_and_handle", label: "Cup & Handle" },
  { value: "inverse_head_shoulders", label: "Inverse H&S" },
  { value: "ascending_triangle", label: "Ascending Triangle" },
  { value: "bullish_pennant", label: "Bullish Pennant" },
  { value: "bullish_flag", label: "Bullish Flag" },
  { value: "descending_trendline", label: "Descending Trendline" },
];

type SortMode = "relevance" | "confidence" | "time";

function formatSafeRelativeTime(isoDate: string | undefined, nowMs: number): string {
  if (!isoDate || nowMs <= 0) return "Just now";
  const dateMs = new Date(isoDate).getTime();
  if (isNaN(dateMs)) return "Just now";
  const diffSeconds = Math.max(0, Math.floor((nowMs - dateMs) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
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
        <circle cx="24" cy="24" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="transparent" />
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

export default function SignalsGridPage() {
  const router = useRouter();
  const { signals, settings, isInitialLoading, triggerRefresh } = useDashboardSocket();
  const [nowMs, setNowMs] = useState<number>(0);

  const [selectedTf, setSelectedTf] = useState<TimeframeFilter>("ALL");
  const [selectedPattern, setSelectedPattern] = useState<string>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  // Initialize Min Score directly from Control Center settings (e.g., 65)!
  const [minScore, setMinScore] = useState<number>(settings?.min_score ?? 65);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyReady, setOnlyReady] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");

  // Keep slider synced whenever Control Center min_score is updated
  useEffect(() => {
    if (settings?.min_score !== undefined) {
      setMinScore(settings.min_score);
    }
  }, [settings?.min_score]);

  useEffect(() => {
    setNowMs(Date.now());
  }, [signals]);

  const filteredSignals = useMemo(() => {
    if (signals.length === 0) return [];

    const list = signals.filter((sig) => {
      const cleanSym = sig.symbol.trim().toUpperCase();
      if (onlyReady && sig.is_extended) return false;

      const matchesTf =
        selectedTf === "ALL" ||
        sig.timeframe.toLowerCase() === selectedTf.toLowerCase();
      const matchesPattern =
        selectedPattern === "ALL" ||
        sig.structure.toLowerCase() === selectedPattern.toLowerCase();

      // NEW: outcome filter (falls back to PENDING if backend doesn't emit the field yet)
      const signalOutcome =
        (sig as any).outcome ?? (sig as any).status ?? "PENDING";
      const matchesOutcome =
        outcomeFilter === "ALL" || signalOutcome === outcomeFilter;

      const matchesScore = sig.confidence >= minScore;
      const matchesSearch =
        !searchQuery.trim() ||
        cleanSym.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        sig.structure.toLowerCase().includes(searchQuery.trim().toLowerCase());

      return (
        matchesTf &&
        matchesPattern &&
        matchesOutcome &&
        matchesScore &&
        matchesSearch
      );
    });

    return [...list].sort((a, b) => {
      const timeA = a.detected_at ? new Date(a.detected_at).getTime() : 0;
      const timeB = b.detected_at ? new Date(b.detected_at).getTime() : 0;

      if (sortMode === "relevance") {
        const refNow = nowMs > 0 ? nowMs : timeA;
        const ageHoursA = Math.max(0, (refNow - timeA) / 3600000);
        const ageHoursB = Math.max(0, (refNow - timeB) / 3600000);

        const freshScoreA = Math.max(0, 45 - ageHoursA * 4.5);
        const freshScoreB = Math.max(0, 45 - ageHoursB * 4.5);

        const readyBonusA = a.is_extended ? 0 : 25;
        const readyBonusB = b.is_extended ? 0 : 25;

        const wallBonusA = (a.p2_wall_score ?? 0) > 0 ? 15 : 0;
        const wallBonusB = (b.p2_wall_score ?? 0) > 0 ? 15 : 0;

        return (
          b.confidence + freshScoreB + readyBonusB + wallBonusB -
          (a.confidence + freshScoreA + readyBonusA + wallBonusA)
        );
      }

      if (sortMode === "confidence") {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return timeB - timeA;
      }

      const bucketA = Math.floor(timeA / 120000);
      const bucketB = Math.floor(timeB / 120000);
      if (bucketB !== bucketA) return bucketB - bucketA;
      return b.confidence - a.confidence;
    });
  }, [
    signals,
    nowMs,
    selectedTf,
    selectedPattern,
    outcomeFilter,
    minScore,
    searchQuery,
    onlyReady,
    sortMode,
  ]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6 pb-20">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-white sm:text-lg">
                  4-Pillar Breakout Signals
                </h1>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-300">
                  {filteredSignals.length} Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Click any signal card to open its full Deep-Dive Chart & Order Book Terminal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                className="w-full sm:w-44 rounded-xl border border-slate-700/60 bg-[#07090E]/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
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

        {/* Sort on LEFT, Pattern + Min Score + Ready Only on RIGHT */}
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
                onChange={(e) => setMinScore(Number(e.target.value))}
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

      <div className="min-h-[520px]">
        {isInitialLoading && signals.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-60 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredSignals.map((sig) => {
                const cleanSym = sig.symbol.trim().toUpperCase();
                const stableKey = sig.id
                  ? `sig-${sig.id}`
                  : `${cleanSym}-${sig.timeframe}-${sig.detected_at || ""}`;
                const entryVal =
                  sig.entry_high || sig.breakout_price || sig.entry_low;

                const isFresh =
                  nowMs > 0 &&
                  Boolean(sig.detected_at) &&
                  nowMs - new Date(sig.detected_at!).getTime() < 3600000;

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
                      !sig.is_extended && isFresh
                        ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.08] via-slate-900/90 to-[#0A0E17] hover:border-emerald-400/70"
                        : "border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-[#0A0E17] hover:border-cyan-500/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xl font-black tracking-tight text-white group-hover:text-cyan-300">
                            <span>{cleanSym}</span>
                            <ArrowUpRight className="h-4 w-4 text-cyan-400" />
                          </span>
                          <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                            {sig.timeframe}
                          </span>
                          {isFresh && !sig.is_extended && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              <Zap className="h-2.5 w-2.5" /> Fresh
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{formatSafeRelativeTime(sig.detected_at, nowMs)}</span>
                          <span>•</span>
                          {sig.is_extended ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                              <AlertTriangle className="h-3 w-3 text-amber-400" />
                              Wait for Retest
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              Ready
                            </span>
                          )}
                        </div>
                      </div>

                      <ScoreCircleBadge score={sig.confidence} />
                    </div>

                    <div className="my-3.5 space-y-2.5 border-y border-white/[0.06] py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Structure
                        </span>
                        <span className="text-sm font-bold text-white">
                          {formatPatternName(sig.structure)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                          Vol {(sig.volume_ratio ?? 2.1).toFixed(1)}x
                        </span>
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
                        {(sig.p2_wall_score ?? 0) > 0 && (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            🧱 L2 Bid Wall
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-2.5 text-center">
                        <span className="block text-[10px] font-semibold uppercase text-cyan-300/80">
                          Entry
                        </span>
                        <span className="mt-0.5 block font-mono text-xs font-bold text-white">
                          ${formatCryptoPrice(entryVal)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-2.5 text-center">
                        <span className="block text-[10px] font-semibold uppercase text-rose-300/80">
                          Stop Loss
                        </span>
                        <span className="mt-0.5 block font-mono text-xs font-bold text-rose-400">
                          ${formatCryptoPrice(sig.stop_loss)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-2.5 text-center">
                        <span className="block text-[10px] font-semibold uppercase text-emerald-300/80">
                          TP1 (1.5R)
                        </span>
                        <span className="mt-0.5 block font-mono text-xs font-bold text-emerald-400">
                          ${formatCryptoPrice(sig.tp1_price)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <button
        onClick={triggerRefresh}
        aria-label="Refresh Signals"
        className="fixed bottom-6 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg md:hidden"
      >
        <RefreshCw className="h-5 w-5" />
      </button>
    </main>
  );
}