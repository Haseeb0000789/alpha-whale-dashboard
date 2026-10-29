// components/SignalModal.tsx
"use client";

import React from "react";
import {
  Signal,
  formatCryptoPrice,
  formatPatternName,
  formatRelativeTime,
} from "@/types/types";
import {
  X,
  ExternalLink,
  ShieldCheck,
  BarChart3,
  Cpu,
  Bitcoin,
  Target,
  AlertOctagon,
  Sparkles,
  CheckCircle2,
  Ban, // <-- Naya icon blacklist ke liye
} from "lucide-react";

interface SignalModalProps {
  signal: Signal | null;
  onClose: () => void;
  onBlacklist: (symbol: string) => Promise<void>; // <-- Naya Prop
  isBlacklisting: boolean; // <-- Naya Prop
}

export default function SignalModal({ 
  signal, 
  onClose, 
  onBlacklist, 
  isBlacklisting 
}: SignalModalProps) {
  if (!signal) return null;

  const cleanSymbol = signal.symbol.trim().toUpperCase();
  const pillars = [
    {
      label: "Pillar 1: Volume & Taker Flow",
      earned: signal.p1_volume_score ?? 0,
      max: 25,
      icon: BarChart3,
      color: "from-cyan-400 to-blue-500",
      desc: "Relative Volume (RVOL) surge + aggressive market buy dominance",
    },
    {
      label: "Pillar 2: L2 Order Book Bid Wall",
      earned: signal.p2_wall_score ?? 0,
      max: 25,
      icon: ShieldCheck,
      color: "from-emerald-400 to-teal-500",
      desc: "Active whale bid support within 3% + 7-day wall respect history",
    },
    {
      label: "Pillar 3: Technical Structure & SMC",
      earned: signal.p3_structure_score ?? 0,
      max: 40,
      icon: Cpu,
      color: "from-purple-400 to-indigo-500",
      desc: "Breakout geometry + EMA/RSI/MACD + Smart Money BoS/OB alignment",
    },
    {
      label: "Pillar 4: BTC Market Regime",
      earned: signal.p4_btc_score ?? 10,
      max: 10,
      icon: Bitcoin,
      color: "from-amber-400 to-orange-500",
      desc: "Bitcoin 45m stability filter protecting against market-wide dumps",
    },
  ];

  const entryLow = signal.entry_low || signal.level_price || signal.breakout_price;
  const entryHigh = signal.entry_high || signal.breakout_price;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#0A0E17] shadow-[0_0_60px_rgba(6,182,212,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow Banner */}
        <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-purple-500/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                {cleanSymbol} <span className="text-sm font-normal text-slate-400">/ USDT</span>
              </h2>
              <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-300">
                {signal.timeframe}
              </span>
              {signal.is_extended ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-0.5 text-xs font-semibold text-amber-300">
                  ⚠️ Extended — Wait for Retest
                </span>
              ) : (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                  ✅ Ready for Spot Entry
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Pattern: <strong className="text-slate-200">{formatPatternName(signal.structure)}</strong> • Detected {formatRelativeTime(signal.detected_at)}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
          {/* 1. 4-Pillar Confluence Breakdown */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                4-Pillar Confluence Breakdown
              </h3>
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-sm font-bold text-emerald-400">
                Total Score: {signal.confidence.toFixed(0)} / 100
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pillars.map((p, idx) => {
                const Icon = p.icon;
                const pct = Math.max(0, Math.min(100, (p.earned / p.max) * 100));
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-cyan-400" />
                        {p.label}
                      </span>
                      <span className="font-mono text-cyan-300">
                        {p.earned.toFixed(0)}/{p.max}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${p.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Smart Money Concepts (SMC) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-slate-900/60 px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="font-semibold text-slate-200">SMC Confluence:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`flex items-center gap-1 font-medium ${signal.smc_bos ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Break of Structure (BoS): {signal.smc_bos ? "Confirmed" : "No"}
              </span>
              <span className={`flex items-center gap-1 font-medium ${signal.smc_ob ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Order Block (OB): {signal.smc_ob ? "Aligned" : "No"}
              </span>
            </div>
          </div>

          {/* 3. Actionable Spot Trade Plan */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Target className="h-4 w-4 text-emerald-400" />
              Complete Spot Trade Plan
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3.5">
                <span className="text-[11px] font-medium text-cyan-300">Entry Zone</span>
                <p className="mt-1 font-mono text-sm font-bold text-white">
                  ${formatCryptoPrice(entryLow)}
                </p>
                <span className="text-[10px] text-slate-400">
                  to ${formatCryptoPrice(entryHigh)}
                </span>
              </div>

              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-3.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-rose-300">
                  <AlertOctagon className="h-3 w-3" /> Stop Loss
                </span>
                <p className="mt-1 font-mono text-sm font-bold text-rose-400">
                  ${formatCryptoPrice(signal.stop_loss)}
                </p>
                <span className="text-[10px] text-rose-300/70">Below Wall / Level</span>
              </div>

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
                <span className="text-[11px] font-medium text-emerald-300">TP1 Target (1.5R)</span>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-400">
                  ${formatCryptoPrice(signal.tp1_price)}
                </p>
                <span className="text-[10px] text-emerald-300/70">Move SL to BE</span>
              </div>

              <div className="rounded-2xl border border-purple-500/25 bg-purple-500/[0.06] p-3.5">
                <span className="text-[11px] font-medium text-purple-300">TP2 Target (2.5R)</span>
                <p className="mt-1 font-mono text-sm font-bold text-purple-400">
                  ${formatCryptoPrice(signal.tp2_price)}
                </p>
                <span className="text-[10px] text-purple-300/70">Runner Target</span>
              </div>
            </div>
          </div>

          {/* 4. External Links & Blacklist Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`https://dexscreener.com/search?q=${encodeURIComponent(cleanSymbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
              >
                <span>DexScreener</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <a
                href={`https://www.binance.com/en/trade/${encodeURIComponent(cleanSymbol)}_USDT`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
              >
                <span>Binance</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="flex gap-2">
              {/* BLACKLIST BUTTON YAHAN HAI */}
              <button
                onClick={() => onBlacklist(signal.symbol)}
                disabled={isBlacklisting}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/25 disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" />
                {isBlacklisting ? "Blacklisting..." : "Blacklist Coin"}
              </button>

              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}