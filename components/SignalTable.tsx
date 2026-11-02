// components/SignalTable.tsx
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
import { SignalTableSkeleton } from "./Skeletons";
import {
  Search,
  Filter,
  Trash2,
  ChevronRight,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  ArrowUpRight,
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

export interface SignalCardProps {
  sig: Signal;
  nowMs: number;
  isSpotCard?: boolean;
  onClick?: () => void;
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

export function exportToCSV(data: Signal[]) {
  if (!data || data.length === 0) return;

  const headers = [
    "Symbol",
    "Pattern",
    "Timeframe",
    "Score",
    "Entry Low",
    "Entry High",
    "Stop Loss",
    "TP1",
    "TP2",
    "Volume Ratio",
    "Status",
    "Detected At",
  ];

  const escapeCsvCell = (val: string | number | boolean | undefined | null) => {
    if (val === undefined || val === null) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const rows = data.map((s) =>
    [
      s.symbol.trim().toUpperCase(),
      formatPatternName(s.structure),
      s.timeframe,
      s.confidence.toFixed(1),
      s.entry_low || s.level_price || s.breakout_price || 0,
      s.entry_high || s.breakout_price || 0,
      s.stop_loss || 0,
      s.tp1_price || 0,
      s.tp2_price || 0,
      (s.volume_ratio ?? 1.0).toFixed(2),
      s.is_extended ? "Extended" : "Ready",
      s.detected_at || new Date().toISOString(),
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `alpha-terminal-signals-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatSafeRelativeTime(isoDate: string | undefined, nowMs: number): string {
  if (!isoDate || nowMs <= 0) return "Live now";
  return formatRelativeTime(isoDate, nowMs);
}

function ScoreBadge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const color =
    clamped >= 80
      ? "text-emerald-400 border-emerald-500/30"
      : clamped >= 68
      ? "text-amber-300 border-amber-500/30"
      : "text-slate-300 border-white/10";

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white/[0.03] font-mono text-xs font-bold ${color}`}
    >
      {clamped}
    </div>
  );
}

function OutcomePill({ sig }: { sig: Signal }) {
  const status: SignalOutcomeStatus = sig.outcome_status || "IN_PLAY";
  const maxGain = sig.max_gain_pct ?? 0;
  const maxDd = sig.max_drawdown_pct ?? 0;
  const pillBase =
    "inline-flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold";

  if (status === "TP2_HIT") {
    return (
      <span className={`${pillBase} text-emerald-400`}>
        TP2 Hit {maxGain > 0 ? `+${maxGain.toFixed(1)}%` : ""}
      </span>
    );
  }
  if (status === "TP1_HIT") {
    return (
      <span className={`${pillBase} text-emerald-400`}>
        TP1 Hit {maxGain > 0 ? `+${maxGain.toFixed(1)}%` : ""}
      </span>
    );
  }
  if (status === "BREAKEVEN") {
    return (
      <span className={`${pillBase} text-slate-300`}>
        Breakeven {maxGain > 0 ? `(+${maxGain.toFixed(1)}%)` : ""}
      </span>
    );
  }
  if (status === "SL_HIT") {
    return (
      <span className={`${pillBase} text-rose-400`}>
        SL Hit {maxDd < 0 ? `${maxDd.toFixed(1)}%` : ""}
      </span>
    );
  }
  return (
    <span className={`${pillBase} text-slate-300`}>
      In-Play {maxGain > 0 ? `+${maxGain.toFixed(1)}%` : ""}
    </span>
  );
}

export function SignalCard({ sig, nowMs, isSpotCard = false, onClick }: SignalCardProps) {
  const cleanSym = (sig.symbol || "").trim().toUpperCase();

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
    (sig.outcome_status || "IN_PLAY") === "IN_PLAY" && !sig.outcome_finalized;
  const isFresh =
    nowMs > 0 && isStillInPlay && sigAgeMs >= 0 && sigAgeMs < 3600000;

  const tradeStyle =
    sig.trade_style ||
    (sig.timeframe === "4h" || sig.timeframe === "1d" ? "SWING" : "SCALP");

  const tp1Pct =
    entryVal && tp1Val
      ? (((tp1Val - entryVal) / entryVal) * 100).toFixed(1)
      : "1.8";

  const pillClass =
    "rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-300";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14 }}
      onClick={onClick}
      className="group flex cursor-pointer flex-col justify-between rounded-lg border border-white/10 bg-[#121418] p-3.5 transition-colors hover:border-white/25"
    >
      {/* Top Row: Symbol + Subtle Pills + Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-sm font-extrabold tracking-tight text-white group-hover:text-slate-200">
              <span>{cleanSym}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-slate-300" />
            </span>

            <span className={pillClass}>{sig.timeframe}</span>

            {isSpotCard && (
              <span className={pillClass}>
                {tradeStyle === "SCALP" ? "Scalp" : "Swing"}
              </span>
            )}

            {isFresh && !sig.is_extended && !isSpotCard && (
              <span className={pillClass}>Fresh</span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span>{formatSafeRelativeTime(sig.detected_at, nowMs)}</span>
            <span>•</span>
            <OutcomePill sig={sig} />
          </div>
        </div>

        <ScoreBadge score={sig.confidence} />
      </div>

      {/* Middle Row: Pattern Name & Minimal Metrics (SMC BoS & OB Zone removed) */}
      <div className="my-2.5 space-y-2 border-y border-white/[0.06] py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500">Pattern</span>
          <span className="truncate text-xs font-bold text-slate-200">
            {formatPatternName(sig.structure)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={pillClass}>
            Vol {(sig.volume_ratio ?? 2.1).toFixed(1)}x
          </span>

          {sig.taker_buy_ratio ? (
            <span className={pillClass}>
              Buy {Math.round(sig.taker_buy_ratio * 100)}%
            </span>
          ) : null}

          {sig.rs_vs_btc !== undefined && sig.rs_vs_btc !== null && (
            <span className={pillClass}>
              RS {sig.rs_vs_btc >= 0 ? "+" : ""}
              {sig.rs_vs_btc.toFixed(1)}%
            </span>
          )}

          <span className={pillClass}>
            {sig.is_extended ? "Extended" : "Ready"}
          </span>
        </div>
      </div>

      {/* Bottom Row: Entry, Stop Loss, TP1 / TP2 */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="min-w-0 rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
          <span className="block text-[10px] font-medium text-slate-500">
            Entry
          </span>
          <span
            className="mt-0.5 block truncate font-mono text-xs font-bold text-white"
            title={`$${formatCryptoPrice(entryVal)}`}
          >
            ${formatCryptoPrice(entryVal)}
          </span>
        </div>

        <div className="min-w-0 rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
          <span className="block text-[10px] font-medium text-slate-500">
            Stop Loss
          </span>
          <span
            className="mt-0.5 block truncate font-mono text-xs font-bold text-rose-400"
            title={`$${formatCryptoPrice(stopLossVal)}`}
          >
            ${formatCryptoPrice(stopLossVal)}
          </span>
        </div>

        <div className="min-w-0 rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
          <span className="block truncate text-[10px] font-medium text-slate-500">
            TP1 (+{tp1Pct}%)
          </span>
          <span
            className="mt-0.5 block truncate font-mono text-xs font-bold text-emerald-400"
            title={`TP1: $${formatCryptoPrice(tp1Val)} | TP2: $${formatCryptoPrice(tp2Val)}`}
          >
            ${formatCryptoPrice(tp1Val)}
          </span>
        </div>
      </div>
    </motion.div>
  );
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
  const [selectedPattern, setSelectedPattern] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(0);
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const processedSignals = useMemo(() => {
    const filtered = signals.filter((sig) => {
      const matchesPattern =
        selectedPattern === "ALL" ||
        sig.structure.toLowerCase() === selectedPattern.toLowerCase();
      const matchesScore = sig.confidence >= minScore;
      return matchesPattern && matchesScore;
    });

    return [...filtered].sort((a, b) => {
      const comparison =
        sortField === "confidence"
          ? a.confidence - b.confidence
          : (a.detected_at ? new Date(a.detected_at).getTime() : 0) -
            (b.detected_at ? new Date(b.detected_at).getTime() : 0);
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

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="h-3 w-3 text-slate-200" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-200" />
    );
  };

  return (
    <div className="flex flex-col rounded-lg border border-white/10 bg-[#121418]">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Signals Feed
          </h2>
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300">
            {processedSignals.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol..."
              className="w-40 rounded-md border border-white/10 bg-[#0B0E11] py-1 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 focus:border-white/25 focus:outline-none"
            />
          </div>

          <button
            onClick={() => exportToCSV(processedSignals)}
            disabled={processedSignals.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>

          <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0B0E11] p-0.5">
            <Filter className="ml-1.5 mr-1 h-3 w-3 text-slate-500" />
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={`rounded px-2 py-0.5 text-xs font-semibold transition ${
                  selectedTf === tf
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400">Pattern:</span>
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="rounded-md border border-white/10 bg-[#0B0E11] px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none"
            >
              {PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Min Score:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-slate-300"
            />
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-300">
              {minScore}+
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-white/[0.08] bg-[#0B0E11] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-3 pl-4 pr-3">
                <button
                  onClick={() => handleSort("detected_at")}
                  className="group flex items-center gap-1.5 uppercase"
                >
                  <span>Symbol</span>
                  {renderSortIcon("detected_at")}
                </button>
              </th>
              <th className="px-3 py-3">Pattern & Flow</th>
              <th className="px-3 py-3">TF</th>
              <th className="px-3 py-3">
                <button
                  onClick={() => handleSort("confidence")}
                  className="group flex items-center gap-1.5 uppercase"
                >
                  <span>Score</span>
                  {renderSortIcon("confidence")}
                </button>
              </th>
              <th className="px-3 py-3">Entry</th>
              <th className="px-3 py-3">Stop Loss</th>
              <th className="px-3 py-3">TP1</th>
              <th className="px-3 py-3">Status</th>
              <th className="py-3 pl-2 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] text-xs">
            {isLoading && signals.length === 0 ? (
              <SignalTableSkeleton rows={6} />
            ) : processedSignals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                  No signals match your current filter criteria.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {processedSignals.map((sig) => {
                  const cleanSym = sig.symbol.trim().toUpperCase();
                  const entryLow =
                    sig.entry_low || sig.level_price || sig.breakout_price;
                  const entryHigh = sig.entry_high || sig.breakout_price;
                  const isBeingRemoved = removingSymbol === cleanSym;

                  return (
                    <motion.tr
                      key={`${cleanSym}-${sig.timeframe}-${sig.detected_at || ""}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isBeingRemoved ? 0.35 : 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => onSelectSignal(sig)}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/coin/${encodeURIComponent(cleanSym)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-sm font-extrabold text-white transition hover:text-slate-300"
                          >
                            <span>{cleanSym}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
                          </Link>
                          <span className="text-[11px] text-slate-500">
                            {formatRelativeTime(sig.detected_at)}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-200">
                            {formatPatternName(sig.structure)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                              Vol {(sig.volume_ratio ?? 2.0).toFixed(1)}x
                            </span>
                            {sig.taker_buy_ratio ? (
                              <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                                Buy {Math.round(sig.taker_buy_ratio * 100)}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                          {sig.timeframe}
                        </span>
                      </td>

                      <td className="px-3 py-3 font-mono text-xs font-bold text-white">
                        {sig.confidence.toFixed(0)}
                      </td>

                      <td className="px-3 py-3 font-mono text-slate-200">
                        ${formatCryptoPrice(entryHigh || entryLow)}
                      </td>

                      <td className="px-3 py-3 font-mono text-rose-400">
                        ${formatCryptoPrice(sig.stop_loss)}
                      </td>

                      <td className="px-3 py-3 font-mono font-bold text-emerald-400">
                        ${formatCryptoPrice(sig.tp1_price)}
                      </td>

                      <td className="px-3 py-3">
                        <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {sig.is_extended ? "Extended" : "Ready"}
                        </span>
                      </td>

                      <td className="py-3 pl-2 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleBlacklistClick(e, cleanSym)}
                            disabled={isBeingRemoved}
                            className="rounded border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <span className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-slate-300 group-hover:border-white/25">
                            Chart
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
