// components/SignalTable.tsx
"use client";

import React from "react";
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
  ChevronRight,
  Cpu,
  Sparkles,
} from "lucide-react";

interface SignalTableProps {
  signals: Signal[];
  isLoading: boolean;
  selectedTf: TimeframeFilter;
  setSelectedTf: (tf: TimeframeFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectSignal: (signal: Signal) => void;
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
}: SignalTableProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-cyan-400 text-emerald-300 border-emerald-500/30";
    if (score >= 68) return "from-cyan-400 to-blue-400 text-cyan-300 border-cyan-500/30";
    return "from-amber-400 to-orange-400 text-amber-300 border-amber-500/30";
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-[#0B0F17]/90 backdrop-blur-xl">
      {/* Toolbar: Title, Search & Timeframe Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              4-Pillar Breakout Signal Feed
              <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300 border border-cyan-500/20">
                {signals.length} Signals
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Click any row to open the 4-Pillar breakdown, SMC confirmation & Spot trade plan
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g. FHE, DOS)..."
              className="w-52 rounded-xl border border-white/10 bg-[#07090E]/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>

          {/* Timeframe Dropdown & Pill Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#07090E]/90 p-1">
            <Filter className="ml-2 mr-1 h-3.5 w-3.5 text-slate-400" />
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedTf === tf
                    ? "bg-gradient-to-r from-cyan-500/25 to-emerald-500/25 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#0B0F17]/95 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
            <tr>
              <th className="py-3.5 pl-6 pr-3">Symbol</th>
              <th className="px-3 py-3.5">Pattern & SMC</th>
              <th className="px-3 py-3.5">TF</th>
              <th className="px-3 py-3.5">4-Pillar Score</th>
              <th className="px-3 py-3.5">Entry Zone</th>
              <th className="px-3 py-3.5">Stop Loss</th>
              <th className="px-3 py-3.5">TP1 Target</th>
              <th className="px-3 py-3.5">Status</th>
              <th className="py-3.5 pl-2 pr-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-xs">
            {isLoading && signals.length === 0 ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="px-6 py-4">
                    <div className="h-6 rounded bg-slate-800/60" />
                  </td>
                </tr>
              ))
            ) : signals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-14 text-center text-slate-500">
                  No signals match your current filter criteria.
                </td>
              </tr>
            ) : (
              signals.map((sig, idx) => {
                const entryLow = sig.entry_low || sig.level_price || sig.breakout_price;
                const entryHigh = sig.entry_high || sig.breakout_price;
                const slPct =
                  entryHigh && sig.stop_loss
                    ? (((entryHigh - sig.stop_loss) / entryHigh) * 100).toFixed(1)
                    : null;

                return (
                  <tr
                    key={`${sig.symbol}-${sig.timeframe}-${sig.detected_at}-${idx}`}
                    onClick={() => onSelectSignal(sig)}
                    className="group cursor-pointer transition-all hover:bg-cyan-500/[0.06]"
                  >
                    {/* Symbol & Time */}
                    <td className="py-4 pl-6 pr-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition">
                          {sig.symbol.trim()}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatRelativeTime(sig.detected_at)}
                        </span>
                      </div>
                    </td>

                    {/* Pattern + SMC Badges */}
                    <td className="px-3 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-200">
                          {formatPatternName(sig.structure)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {sig.smc_bos && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300 border border-purple-500/25">
                              <Sparkles className="h-2.5 w-2.5" /> BoS
                            </span>
                          )}
                          {sig.smc_ob && (
                            <span className="inline-flex items-center rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/25">
                              OB Zone
                            </span>
                          )}
                          {sig.p2_wall_score > 0 && (
                            <span className="inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/25">
                              🧱 L2 Wall
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Timeframe */}
                    <td className="px-3 py-4">
                      <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-xs font-semibold text-slate-200">
                        {sig.timeframe}
                      </span>
                    </td>

                    {/* 4-Pillar Score Progress Bar */}
                    <td className="px-3 py-4">
                      <div className="w-32">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-white">
                            {sig.confidence.toFixed(0)}
                            <span className="text-slate-500 font-normal">/100</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {sig.confidence >= 80 ? " Prime" : "Valid"}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${getScoreColor(
                              sig.confidence
                            )}`}
                            style={{ width: `${Math.min(100, Math.max(10, sig.confidence))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Entry */}
                    <td className="px-3 py-4 font-mono text-slate-200">
                      ${formatCryptoPrice(entryLow)}
                      {entryHigh && entryHigh !== entryLow && (
                        <span className="text-slate-400"> – ${formatCryptoPrice(entryHigh)}</span>
                      )}
                    </td>

                    {/* Stop Loss */}
                    <td className="px-3 py-4 font-mono text-rose-400">
                      {sig.stop_loss ? (
                        <div>
                          <span>${formatCryptoPrice(sig.stop_loss)}</span>
                          {slPct && (
                            <span className="ml-1 text-[10px] text-rose-400/75">(-{slPct}%)</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* TP1 */}
                    <td className="px-3 py-4 font-mono font-semibold text-emerald-400">
                      {sig.tp1_price ? `$${formatCryptoPrice(sig.tp1_price)}` : "—"}
                    </td>

                    {/* Visual Status Badge */}
                    <td className="px-3 py-4">
                      {sig.is_extended ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          ⚠️ Wait for Retest
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ✅ Ready
                        </span>
                      )}
                    </td>

                    {/* Deep Dive Action */}
                    <td className="py-4 pl-2 pr-6 text-right">
                      <button className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition group-hover:border-cyan-500/40 group-hover:bg-cyan-500/15 group-hover:text-cyan-300">
                        Inspect
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}