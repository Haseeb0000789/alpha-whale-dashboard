// app/signals/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import SignalModal from "@/components/SignalModal";
import { exportToCSV } from "@/components/SignalTable";
import {
  Signal,
  TimeframeFilter,
  formatCryptoPrice,
  formatPatternName,
  formatRelativeTime,
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
  Trash2,
  ArrowUpRight,
  Cpu,
  Ban,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 7000;

const TIMEFRAMES: TimeframeFilter[] = ["ALL", "15m", "1h", "4h", "1d"];

const PATTERN_OPTIONS = [
  { value: "ALL", label: "All Patterns" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "cup_and_handle", label: "Cup & Handle" },
  { value: "inverse_head_shoulders", label: "Inverse H&S" },
  { value: "ascending_triangle", label: "Ascending Triangle" },
  { value: "bullish_pennant", label: "Bullish Pennant" },
  { value: "bullish_flag", label: "Bullish Flag" },
];

const FALLBACK_SIGNALS: Signal[] = [
  {
    id: 101,
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
    detected_at: "2026-10-30T11:38:00.000Z",
    smc_bos: true,
    smc_ob: true,
    smc_retest: true,
  },
  {
    id: 102,
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
    detected_at: "2026-10-30T11:45:00.000Z",
    smc_bos: true,
    smc_ob: false,
  },
  {
    id: 103,
    symbol: "LYN",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 68,
    p1_volume_score: 20,
    p2_wall_score: 0,
    p3_structure_score: 38,
    p4_btc_score: 10,
    entry_low: 0.0154486,
    entry_high: 0.0156351,
    stop_loss: 0.0148913,
    tp1_price: 0.0167509,
    tp2_price: 0.0174947,
    volume_ratio: 4.0,
    taker_buy_ratio: 0.59,
    is_extended: false,
    detected_at: "2026-10-30T11:30:00.000Z",
    smc_bos: true,
    smc_ob: true,
  },
  {
    id: 104,
    symbol: "GUA",
    structure: "cup_and_handle",
    timeframe: "4h",
    confidence: 67,
    p1_volume_score: 19,
    p2_wall_score: 0,
    p3_structure_score: 38,
    p4_btc_score: 10,
    entry_low: 0.0340532,
    entry_high: 0.0343622,
    stop_loss: 0.0326883,
    tp1_price: 0.0368729,
    tp2_price: 0.0385467,
    volume_ratio: 4.5,
    taker_buy_ratio: 0.59,
    is_extended: false,
    detected_at: "2026-10-30T11:20:00.000Z",
    smc_bos: true,
    smc_ob: true,
  },
  {
    id: 105,
    symbol: "RLS",
    structure: "double_bottom",
    timeframe: "1d",
    confidence: 64,
    p1_volume_score: 18,
    p2_wall_score: 12,
    p3_structure_score: 24,
    p4_btc_score: 10,
    entry_low: 0.0023143,
    entry_high: 0.002685,
    stop_loss: 0.00221,
    tp1_price: 0.00295,
    tp2_price: 0.00321,
    volume_ratio: 2.4,
    taker_buy_ratio: 0.62,
    is_extended: true,
    detected_at: "2026-10-30T11:05:00.000Z",
    smc_bos: true,
    smc_ob: false,
  },
  {
    id: 106,
    symbol: "DRV",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 72,
    p1_volume_score: 16,
    p2_wall_score: 8,
    p3_structure_score: 38,
    p4_btc_score: 10,
    entry_low: 0.384311,
    entry_high: 0.386596,
    stop_loss: 0.377376,
    tp1_price: 0.400426,
    tp2_price: 0.409647,
    volume_ratio: 2.3,
    taker_buy_ratio: 0.62,
    is_extended: false,
    detected_at: "2026-10-30T10:50:00.000Z",
    smc_bos: true,
    smc_ob: true,
  },
];

// Circular SVG Score Badge Component
function ScoreCircleBadge({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 80 ? "#10b981" : clamped >= 68 ? "#06b6d4" : "#f59e0b";

  return (
    <div className="relative flex h-13 w-13 items-center justify-center">
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

export default function SignalsGridPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [blacklistedSet, setBlacklistedSet] = useState<Set<string>>(new Set());

  // Separate initial load from background polling to eliminate flickering
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Filter & Modal states
  const [selectedTf, setSelectedTf] = useState<TimeframeFilter>("ALL");
  const [selectedPattern, setSelectedPattern] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"confidence" | "time">("confidence");
  const [activeSignalModal, setActiveSignalModal] = useState<Signal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSignals = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/signals`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("API offline");
        const data = await res.json();
        const raw: Signal[] = Array.isArray(data) ? data : data.signals || [];

        // Upgrade 4: Non-blocking React 18 startTransition
        startTransition(() => {
          setSignals(
            raw.filter(
              (s) => !blacklistedSet.has(s.symbol.trim().toUpperCase())
            )
          );
        });
      } catch {
        startTransition(() => {
          setSignals((prev) =>
            prev.length > 0
              ? prev
              : FALLBACK_SIGNALS.filter(
                  (s) => !blacklistedSet.has(s.symbol.trim().toUpperCase())
                )
          );
        });
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [blacklistedSet]
  );

  useEffect(() => {
    fetchSignals(false);
    const timer = setInterval(() => {
      fetchSignals(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchSignals]);

  const handleBlacklist = useCallback(async (symbol: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    setBlacklistedSet((prev) => new Set(prev).add(cleanSym));
    setSignals((prev) =>
      prev.filter((s) => s.symbol.trim().toUpperCase() !== cleanSym)
    );

    try {
      await fetch(`${API_BASE_URL}/api/dashboard/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: cleanSym }),
      });
    } catch {
      // Optimistically removed
    } finally {
      setToastMessage(`Token Blacklisted: ${cleanSym}`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  }, []);

  const filteredSignals = useMemo(() => {
    const list = signals.filter((sig) => {
      const cleanSym = sig.symbol.trim().toUpperCase();
      if (blacklistedSet.has(cleanSym)) return false;

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
      if (sortBy === "confidence") return b.confidence - a.confidence;
      const tA = a.detected_at ? new Date(a.detected_at).getTime() : 0;
      const tB = b.detected_at ? new Date(b.detected_at).getTime() : 0;
      return tB - tA;
    });
  }, [
    signals,
    blacklistedSet,
    selectedTf,
    selectedPattern,
    minScore,
    searchQuery,
    sortBy,
  ]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 pb-24">
      {/* Top Filter & Control Panel */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Cpu className="h-5 w-5" />
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
              <p className="text-xs text-slate-400">
                Tap any card to launch TradingView chart & L2 Depth analysis
              </p>
            </div>
          </div>

          {/* Search, CSV Export & Timeframe Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                className="w-full sm:w-48 rounded-xl border border-slate-700/60 bg-[#07090E]/90 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            <button
              onClick={() => exportToCSV(filteredSignals)}
              disabled={filteredSignals.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download CSV</span>
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

        {/* Secondary Filter Bar: Pattern Dropdown + Min Score Slider + Sort Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-3.5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
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

            <div className="flex items-center gap-2.5">
              <span className="text-slate-400">Min Score:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="h-1.5 w-28 sm:w-36 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
              />
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                {minScore}+
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sort:</span>
            <button
              onClick={() => setSortBy("confidence")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sortBy === "confidence"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Highest Score
            </button>
            <button
              onClick={() => setSortBy("time")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sortBy === "time"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Newest First
            </button>
          </div>
        </div>
      </div>

      {/* Upgrade 3 & 4: Responsive 3-Column Premium Card Grid (No Flickering / No Layout Shift) */}
      <div className="min-h-[520px]">
        {isInitialLoading && signals.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5"
              />
            ))}
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 text-center">
            <p className="text-sm font-semibold text-slate-300">
              No breakout signals match your active filters.
            </p>
            <button
              onClick={() => {
                setSelectedTf("ALL");
                setSelectedPattern("ALL");
                setMinScore(0);
                setSearchQuery("");
              }}
              className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-300"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredSignals.map((sig) => {
                const cleanSym = sig.symbol.trim().toUpperCase();
                const stableKey = sig.id
                  ? `sig-${sig.id}`
                  : `${cleanSym}-${sig.timeframe}`;
                const entryVal =
                  sig.entry_high || sig.breakout_price || sig.entry_low;

                return (
                  <motion.div
                    key={stableKey}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setActiveSignalModal(sig)}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-[#0A0E17] p-5 shadow-lg backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)]"
                  >
                    {/* Card Top: Symbol + Timeframe (Left) & 4-Pillar Score Ring (Right) */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/coin/${encodeURIComponent(cleanSym)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xl font-black tracking-tight text-white transition hover:text-cyan-300"
                          >
                            <span>{cleanSym}</span>
                            <ArrowUpRight className="h-4 w-4 text-cyan-400 opacity-80" />
                          </Link>

                          <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                            {sig.timeframe}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{formatRelativeTime(sig.detected_at)}</span>
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

                      {/* Top Right: Circular 4-Pillar Score + Trash Button */}
                      <div className="flex items-center gap-2">
                        <ScoreCircleBadge score={sig.confidence} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlacklist(cleanSym);
                          }}
                          title={`Blacklist ${cleanSym}`}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-400 transition hover:border-rose-500/50 hover:bg-rose-500/25 hover:text-rose-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Card Middle: Pattern Name + SMC Badges (BoS, OB, Wall) */}
                    <div className="my-4 space-y-2.5 border-y border-white/[0.06] py-3.5">
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

                        {sig.p2_wall_score > 0 && (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            🧱 L2 Bid Wall
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom Grid (3 Columns): Entry Zone, Stop Loss (Red), TP1 (Green) */}
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

      {/* Deep-Dive Modal Drawer */}
      <SignalModal
        signal={activeSignalModal}
        onClose={() => setActiveSignalModal(null)}
        onBlacklist={handleBlacklist}
      />

      {/* Mobile Floating Refresh Button */}
      <button
        onClick={() => fetchSignals(true)}
        aria-label="Refresh Signals"
        className="fixed bottom-6 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.5)] transition active:scale-90 md:hidden"
      >
        <RefreshCw
          className={`h-5 w-5 ${isRefreshing || isPending ? "animate-spin" : ""}`}
        />
      </button>

      {/* Blacklist Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="sig-toast"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-rose-500/40 bg-[#0B0F19]/95 px-4 py-3 text-xs font-bold text-rose-300 shadow-2xl backdrop-blur-xl"
          >
            <Ban className="h-4 w-4 text-rose-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}