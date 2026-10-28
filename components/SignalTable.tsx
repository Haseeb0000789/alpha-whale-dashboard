// components/SignalTable.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Sparkles,
  Trash2,
  ChevronRight,
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

  const handleBlacklistClick = async (
    e: React.MouseEvent,
    symbol: string
  ) => {
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

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/85 to-[#0B0F17]/95 shadow-2xl backdrop-blur-xl">
      {/* Top Filter & Search Bar */}
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
                {signals.length} Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Click any row to launch the Deep-Dive Terminal or ban noisy tokens in one click
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter symbol (e.g. FHE, DOS)..."
              className="w-52 rounded-xl border border-white/10 bg-[#07090E]/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>

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

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-white/[0.06] bg-[#0B0F17]/95 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-3.5 pl-6 pr-3">Symbol</th>
              <th className="px-3 py-3.5">Pattern & Flow</th>
              <th className="px-3 py-3.5">TF</th>
              <th className="px-3 py-3.5">4-Pillar Score</th>
              <th className="px-3 py-3.5">Entry Zone</th>
              <th className="px-3 py-3.5">Stop Loss</th>
              <th className="px-3 py-3.5">TP1</th>
              <th className="px-3 py-3.5">Status</th>
              <th className="py-3.5 pl-2 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-xs">
            {isLoading && signals.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="px-6 py-4">
                    <div className="h-7 rounded-lg bg-slate-800/60" />
                  </td>
                </tr>
              ))
            ) : signals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-14 text-center text-slate-500">
                  No breakout signals match your active filter.
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {signals.map((sig,index) => {
                  const cleanSym = sig.symbol.trim().toUpperCase();
                  const entryLow = sig.entry_low || sig.level_price || sig.breakout_price;
                  const entryHigh = sig.entry_high || sig.breakout_price;
                  const isBeingRemoved = removingSymbol === cleanSym;

                  return (
                    <motion.tr
                      layout
                      key={`${cleanSym}-${sig.timeframe}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: isBeingRemoved ? 0.35 : 1, y: 0 }}
                      exit={{ opacity: 0, x: -30, scale: 0.96 }}
                      transition={{ duration: 0.22 }}
                      onClick={() => onSelectSignal(sig)}
                      className="group cursor-pointer transition-colors hover:bg-cyan-500/[0.06]"
                    >
                      {/* Symbol */}
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

                      {/* Actions: Deep-Dive + One-Click Blacklist Trash/Ban Button */}
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