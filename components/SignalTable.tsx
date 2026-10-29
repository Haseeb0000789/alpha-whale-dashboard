// components/SignalTable.tsx
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Signal,
  TimeframeFilter,
  formatCryptoPrice,
  formatPatternName,
  formatRelativeTime,
} from "@/types/types";
import { SignalTableSkeleton } from "./Skeletons";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Sparkles,
  Trash2,
  ChevronRight,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from "lucide-react";

interface SignalTableProps {
  signals: Signal[];
  isLoading: boolean;
  selectedTf: TimeframeFilter;
  setSelectedTf: (tf: TimeframeFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectSignal: (signal: Signal) => void;
  onBlacklist: (symbol: string) => Promise<void>;
}

const TIMEFRAMES: TimeframeFilter[] = ["ALL", "15m", "1h", "4h", "1d"];

const PATTERN_OPTIONS = [
  { value: "ALL", label: "All Patterns" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "cup_and_handle", label: "Cup & Handle" },
  { value: "inverse_head_shoulders", label: "Inverse H&S" },
  { value: "ascending_triangle", label: "Ascending Triangle" },
  { value: "bullish_pennant", label: "Bullish Pennant" },
  { value: "bullish_flag", label: "Bullish Flag" },
  { value: "horizontal_resistance", label: "Horizontal Resistance" },
  { value: "descending_trendline", label: "Descending Trendline" },
];

type SortField = "confidence" | "detected_at";

// Upgrade 4: Utility function to convert filteredSignals into a downloadable CSV file
export function exportToCSV(data: Signal[]) {
  if (!data || data.length === 0) return;

  const headers = [
    "Symbol",
    "Pattern",
    "Timeframe",
    "4-Pillar Score",
    "Vol Score (/25)",
    "Wall Score (/25)",
    "Tech Score (/40)",
    "BTC Score (/10)",
    "Entry Low",
    "Entry High",
    "Stop Loss",
    "TP1",
    "TP2",
    "Volume Ratio (x)",
    "Taker Buy (%)",
    "SMC BoS",
    "SMC OB",
    "Status",
    "Detected At",
  ];

  const escapeCsvCell = (val: string | number | boolean | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = data.map((s) => {
    const takerPct =
      s.taker_buy_ratio !== undefined
        ? s.taker_buy_ratio <= 1
          ? (s.taker_buy_ratio * 100).toFixed(0)
          : s.taker_buy_ratio.toFixed(0)
        : "50";

    return [
      s.symbol.trim().toUpperCase(),
      formatPatternName(s.structure),
      s.timeframe,
      s.confidence.toFixed(1),
      (s.p1_volume_score ?? 0).toFixed(1),
      (s.p2_wall_score ?? 0).toFixed(1),
      (s.p3_structure_score ?? 0).toFixed(1),
      (s.p4_btc_score ?? 10).toFixed(1),
      s.entry_low || s.level_price || s.breakout_price || 0,
      s.entry_high || s.breakout_price || 0,
      s.stop_loss || 0,
      s.tp1_price || 0,
      s.tp2_price || 0,
      (s.volume_ratio ?? 1.0).toFixed(2),
      takerPct,
      s.smc_bos ? "Yes" : "No",
      s.smc_ob ? "Yes" : "No",
      s.is_extended ? "Wait for Retest" : "Ready",
      s.detected_at || new Date().toISOString(),
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.setAttribute("download", `alpha-whale-signals-${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SignalTable({
  signals,
  isLoading,
  selectedTf,
  setSelectedTf,
  searchQuery,
  setSearchQuery,
  onSelectSignal,
  onBlacklist,
}: SignalTableProps) {
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);

  // Upgrade 3 States: Pattern filter, Min Score slider (0-100), and Column Sorting
  const [selectedPattern, setSelectedPattern] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(0);
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending (highest score or newest time first)
    }
  };

  // Apply Pattern Filter, Min Score Slider, and Column Sorting
  const processedSignals = useMemo(() => {
    const filtered = signals.filter((sig) => {
      const matchesPattern =
        selectedPattern === "ALL" ||
        sig.structure.toLowerCase() === selectedPattern.toLowerCase();
      const matchesScore = sig.confidence >= minScore;
      return matchesPattern && matchesScore;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === "confidence") {
        comparison = a.confidence - b.confidence;
      } else {
        const timeA = a.detected_at ? new Date(a.detected_at).getTime() : 0;
        const timeB = b.detected_at ? new Date(b.detected_at).getTime() : 0;
        comparison = timeA - timeB;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [signals, selectedPattern, minScore, sortField, sortAsc]);

  const handleBlacklistClick = async (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const clean = symbol.trim().toUpperCase();
    setRemovingSymbol(clean);
    try {
      await onBlacklist(clean);
    } finally {
      setRemovingSymbol(null);
    }
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-cyan-400";
    if (score >= 68) return "from-cyan-400 to-blue-500";
    return "from-amber-400 to-orange-500";
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="h-3 w-3 text-cyan-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-cyan-400" />
    );
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/85 to-[#0B0F17]/95 shadow-2xl backdrop-blur-xl">
      {/* Row 1: Title, Search Bar, CSV Export Button & Timeframe Pills */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                4-Pillar Breakout Signal Feed
              </h2>
              <span className="rounded-full border border-cyan-500/25 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                {processedSignals.length} Shown
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Click headers to sort by Score or Time • Click any row for Deep-Dive Terminal
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol..."
              className="w-44 rounded-xl border border-white/10 bg-[#07090E]/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>

          {/* Upgrade 4: Download CSV Button next to Search Bar */}
          <button
            onClick={() => exportToCSV(processedSignals)}
            disabled={processedSignals.length === 0}
            title="Export filtered signals to CSV"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#07090E]/90 p-1">
            <Filter className="ml-2 mr-1 h-3.5 w-3.5 text-slate-400" />
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedTf === tf
                    ? "border border-cyan-500/30 bg-gradient-to-r from-cyan-500/25 to-emerald-500/25 text-cyan-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 (Upgrade 3): Advanced Filter Bar — Pattern Dropdown + Minimum Score Slider */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] bg-[#080B12]/70 px-6 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {/* Pattern Dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
            <label htmlFor="pattern-select" className="font-medium text-slate-400">
              Pattern:
            </label>
            <select
              id="pattern-select"
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0D121D] px-2.5 py-1 text-xs font-medium text-slate-200 focus:border-cyan-500/50 focus:outline-none"
            >
              {PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0D121D] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Minimum 4-Pillar Score Slider (0 - 100) */}
          <div className="flex items-center gap-3">
            <label htmlFor="score-slider" className="font-medium text-slate-400">
              Min 4-Pillar Score:
            </label>
            <input
              id="score-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="h-1.5 w-32 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
            />
            <span className="min-w-[44px] rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-center font-mono text-[11px] font-bold text-cyan-300">
              {minScore}+
            </span>
            {minScore > 0 && (
              <button
                onClick={() => setMinScore(0)}
                className="text-[11px] text-slate-400 underline hover:text-white"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Sorted by:{" "}
          <strong className="text-cyan-300">
            {sortField === "confidence" ? "4-Pillar Score" : "Detection Time"}
          </strong>{" "}
          ({sortAsc ? "Ascending" : "Descending"})
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-white/[0.06] bg-[#0B0F17]/95 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              {/* Sortable Time / Symbol Header */}
              <th className="py-3.5 pl-6 pr-3">
                <button
                  onClick={() => handleSort("detected_at")}
                  className="group flex items-center gap-1.5 text-left uppercase tracking-wider transition hover:text-white"
                >
                  <span>Symbol / Time</span>
                  {renderSortIcon("detected_at")}
                </button>
              </th>
              <th className="px-3 py-3.5">Pattern & Flow</th>
              <th className="px-3 py-3.5">TF</th>
              {/* Sortable 4-Pillar Score Header */}
              <th className="px-3 py-3.5">
                <button
                  onClick={() => handleSort("confidence")}
                  className="group flex items-center gap-1.5 text-left uppercase tracking-wider transition hover:text-white"
                >
                  <span>4-Pillar Score</span>
                  {renderSortIcon("confidence")}
                </button>
              </th>
              <th className="px-3 py-3.5">Entry Zone</th>
              <th className="px-3 py-3.5">Stop Loss</th>
              <th className="px-3 py-3.5">TP1</th>
              <th className="px-3 py-3.5">Status</th>
              <th className="py-3.5 pl-2 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-xs">
            {/* Upgrade 5: Sleek Animated Skeleton Loader */}
            {isLoading && signals.length === 0 ? (
              <SignalTableSkeleton rows={6} />
            ) : processedSignals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-14 text-center text-slate-500">
                  No breakout signals match your active pattern or minimum score filters.
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {processedSignals.map((sig) => {
                  const cleanSym = sig.symbol.trim().toUpperCase();
                  const entryLow = sig.entry_low || sig.level_price || sig.breakout_price;
                  const entryHigh = sig.entry_high || sig.breakout_price;
                  const isBeingRemoved = removingSymbol === cleanSym;

                  return (
                    <motion.tr
                      layout
                      key={`${cleanSym}-${sig.timeframe}-${sig.detected_at || ""}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: isBeingRemoved ? 0.35 : 1, y: 0 }}
                      exit={{ opacity: 0, x: -30, scale: 0.96 }}
                      transition={{ duration: 0.22 }}
                      onClick={() => onSelectSignal(sig)}
                      className="group cursor-pointer transition-colors hover:bg-cyan-500/[0.06]"
                    >
                      {/* Symbol & Relative Time */}
                      <td className="py-4 pl-6 pr-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-extrabold text-white transition group-hover:text-cyan-300">
                            {cleanSym}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatRelativeTime(sig.detected_at)}
                          </span>
                        </div>
                      </td>

                      {/* Pattern + SMC & Volume Badges */}
                      <td className="px-3 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-200">
                            {formatPatternName(sig.structure)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                              Vol {(sig.volume_ratio ?? 2.0).toFixed(1)}x
                            </span>
                            {sig.smc_bos && (
                              <span className="inline-flex items-center gap-0.5 rounded border border-purple-500/25 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                                <Sparkles className="h-2.5 w-2.5" /> BoS
                              </span>
                            )}
                            {sig.smc_ob && (
                              <span className="rounded border border-blue-500/25 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                                OB
                              </span>
                            )}
                            {sig.p2_wall_score > 0 && (
                              <span className="rounded border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                                🧱 Wall
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Timeframe */}
                      <td className="px-3 py-4">
                        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-xs font-bold text-slate-200">
                          {sig.timeframe}
                        </span>
                      </td>

                      {/* 4-Pillar Score */}
                      <td className="px-3 py-4">
                        <div className="w-32">
                          <div className="mb-1 flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-white">
                              {sig.confidence.toFixed(0)}
                              <span className="font-normal text-slate-500">/100</span>
                            </span>
                            <span className="text-[10px] text-cyan-400">
                              {sig.confidence >= 80 ? "🔥 Prime" : "Valid"}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${getScoreGradient(
                                sig.confidence
                              )}`}
                              style={{
                                width: `${Math.min(100, Math.max(12, sig.confidence))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Entry Zone */}
                      <td className="px-3 py-4 font-mono text-slate-200">
                        ${formatCryptoPrice(entryLow)}
                        {entryHigh && entryHigh !== entryLow && (
                          <span className="text-slate-400">
                            {" "}
                            – ${formatCryptoPrice(entryHigh)}
                          </span>
                        )}
                      </td>

                      {/* Stop Loss */}
                      <td className="px-3 py-4 font-mono text-rose-400">
                        ${formatCryptoPrice(sig.stop_loss)}
                      </td>

                      {/* TP1 */}
                      <td className="px-3 py-4 font-mono font-bold text-emerald-400">
                        ${formatCryptoPrice(sig.tp1_price)}
                      </td>

                      {/* Status Badge */}
                      <td className="px-3 py-4">
                        {sig.is_extended ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                            ⚠️ Wait for Retest
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            ✅ Ready
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 pl-2 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleBlacklistClick(e, cleanSym)}
                            disabled={isBeingRemoved}
                            title={`Blacklist ${cleanSym}`}
                            className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 transition hover:border-rose-500/50 hover:bg-rose-500/25 hover:text-rose-200 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                          <span className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition group-hover:border-cyan-500/40 group-hover:bg-cyan-500/15 group-hover:text-cyan-300">
                            Analyze
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}