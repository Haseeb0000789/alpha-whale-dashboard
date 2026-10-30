// components/SignalModal.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Signal,
  formatCryptoPrice,
  formatPatternName,
  formatRelativeTime,
} from "@/types/types";
import TradingChart from "./TradingChart";
import DepthChart from "./DepthChart";
import {
  X,
  ExternalLink,
  Ban,
  Target,
  Activity,
  Cpu,
  ShieldCheck,
  BarChart3,
  Bitcoin,
  CheckCircle2,
  XCircle,
  Clock,
  Scale,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

interface SignalModalProps {
  signal: Signal | null;
  onClose: () => void;
  onBlacklist: (symbol: string) => Promise<void>;
  isBlacklisting?: boolean;
}

export default function SignalModal({
  signal,
  onClose,
  onBlacklist,
  isBlacklisting = false,
}: SignalModalProps) {
  const tradeMetrics = useMemo(() => {
    if (!signal) return null;
    const entryRef = signal.entry_high || signal.breakout_price || signal.entry_low || 0;
    const entryLow = signal.entry_low || entryRef;
    const sl = signal.stop_loss || entryRef * 0.975;
    const tp1 = signal.tp1_price || entryRef * 1.035;
    const tp2 = signal.tp2_price || entryRef * 1.06;

    const riskPerUnit = Math.max(entryRef - sl, entryRef * 0.005);
    const rewardTp1 = Math.max(0, tp1 - entryRef);
    const rewardTp2 = Math.max(0, tp2 - entryRef);

    const rrTp1 = riskPerUnit > 0 ? rewardTp1 / riskPerUnit : 1.5;
    const rrTp2 = riskPerUnit > 0 ? rewardTp2 / riskPerUnit : 2.5;

    const riskPct = entryRef > 0 ? ((entryRef - sl) / entryRef) * 100 : 2.5;
    const tp1Pct = entryRef > 0 ? ((tp1 - entryRef) / entryRef) * 100 : 3.8;
    const tp2Pct = entryRef > 0 ? ((tp2 - entryRef) / entryRef) * 100 : 6.2;

    return {
      entryLow,
      entryHigh: entryRef,
      sl,
      tp1,
      tp2,
      rrTp1: rrTp1.toFixed(2),
      rrTp2: rrTp2.toFixed(2),
      riskPct: Math.max(0.1, riskPct).toFixed(2),
      tp1Pct: Math.max(0.1, tp1Pct).toFixed(2),
      tp2Pct: Math.max(0.1, tp2Pct).toFixed(2),
    };
  }, [signal]);

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const score = signal ? Math.min(100, Math.max(0, signal.confidence)) : 0;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const takerBuyPct = useMemo(() => {
    if (!signal) return 50;
    const raw = signal.taker_buy_ratio ?? 0.5;
    return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  }, [signal]);

  const pillars = useMemo(() => {
    if (!signal) return [];
    return [
      {
        name: "Volume & Flow",
        score: signal.p1_volume_score ?? 0,
        max: 25,
        icon: BarChart3,
        barClass: "from-cyan-400 to-blue-500",
      },
      {
        name: "L2 Bid Wall",
        score: signal.p2_wall_score ?? 0,
        max: 25,
        icon: ShieldCheck,
        barClass: "from-emerald-400 to-teal-500",
      },
      {
        name: "Tech & SMC",
        score: signal.p3_structure_score ?? 0,
        max: 40,
        icon: Cpu,
        barClass: "from-purple-400 to-indigo-500",
      },
      {
        name: "BTC Regime",
        score: signal.p4_btc_score ?? 10,
        max: 10,
        icon: Bitcoin,
        barClass: "from-amber-400 to-orange-500",
      },
    ];
  }, [signal]);

  return (
    <AnimatePresence>
      {signal && tradeMetrics && (
        <>
          {/* Glassmorphic Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
          />

          {/* Slide-In Right Sidebar Terminal */}
          <motion.aside
            key="modal-drawer"
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-slate-700/50 bg-[#080B12]/95 shadow-[-20px_0_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500" />

            {/* 1. HEADER */}
            <div className="relative flex items-center justify-between border-b border-slate-700/50 bg-slate-800/40 px-6 py-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    href={`/coin/${encodeURIComponent(signal.symbol.trim().toUpperCase())}`}
                    className="group inline-flex items-center gap-1 text-2xl font-black tracking-tight text-white transition hover:text-cyan-300"
                  >
                    <span>{signal.symbol.trim().toUpperCase()}</span>
                    <ArrowUpRight className="h-5 w-5 text-cyan-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                  <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-300">
                    {signal.timeframe.toUpperCase()}
                  </span>
                  {signal.is_extended ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> Extended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400">
                  Pattern:{" "}
                  <span className="font-semibold text-slate-200">
                    {formatPatternName(signal.structure)}
                  </span>{" "}
                  • {formatRelativeTime(signal.detected_at)}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {pillars.map((p) => (
                    <span
                      key={p.name}
                      className="rounded-md border border-slate-700/50 bg-slate-800/40 px-2 py-0.5 font-mono text-[10px] text-slate-300"
                    >
                      {p.name.split(" ")[0]}:{" "}
                      <strong className="text-cyan-300">{p.score}</strong>/{p.max}
                    </span>
                  ))}
                </div>
              </div>

              {/* Circular 4-Pillar Score Gauge */}
              <div className="flex items-center gap-3">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
                    <defs>
                      <linearGradient id="scoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="9"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r={radius}
                      stroke="url(#scoreRingGrad)"
                      strokeWidth="9"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-xl font-black text-white">
                      {score.toFixed(0)}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">
                      4-Pillar
                    </span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="self-start rounded-xl border border-slate-700/50 bg-slate-800/40 p-2 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-slate-800">
              {/* 2. UPGRADE 2: TRADINGVIEW LIGHTWEIGHT CANDLESTICK CHART */}
              <TradingChart
                symbol={signal.symbol}
                timeframe={signal.timeframe}
                entryPrice={tradeMetrics.entryHigh}
                stopLoss={tradeMetrics.sl}
                tp1Price={tradeMetrics.tp1}
                tp2Price={tradeMetrics.tp2}
                height={250}
              />

              {/* 3. TRADE PLAN & CALCULATED RISK/REWARD RATIO */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-xl">
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Actionable Spot Trade Plan
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    <Scale className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      R:R 1 : {tradeMetrics.rrTp1} (TP1) • 1 : {tradeMetrics.rrTp2} (TP2)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] p-3">
                    <span className="text-[11px] font-medium text-cyan-300">
                      Optimal Entry Zone
                    </span>
                    <p className="mt-1 font-mono text-sm font-bold text-white">
                      ${formatCryptoPrice(tradeMetrics.entryLow)} – $
                      {formatCryptoPrice(tradeMetrics.entryHigh)}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Limit orders near Bid Wall / Level
                    </span>
                  </div>

                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-rose-300">
                        Stop Loss
                      </span>
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                        -{tradeMetrics.riskPct}%
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-rose-400">
                      ${formatCryptoPrice(tradeMetrics.sl)}
                    </p>
                    <span className="text-[10px] text-rose-300/70">
                      ATR + Order Book Wall Protected
                    </span>
                  </div>

                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-emerald-300">
                        Take Profit 1 ({tradeMetrics.rrTp1}R)
                      </span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                        +{tradeMetrics.tp1Pct}%
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-emerald-400">
                      ${formatCryptoPrice(tradeMetrics.tp1)}
                    </p>
                    <span className="text-[10px] text-emerald-300/70">
                      Book 50% & Move SL to Breakeven
                    </span>
                  </div>

                  <div className="rounded-xl border border-purple-500/25 bg-purple-500/[0.07] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-purple-300">
                        Take Profit 2 ({tradeMetrics.rrTp2}R)
                      </span>
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-300">
                        +{tradeMetrics.tp2Pct}%
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-purple-400">
                      ${formatCryptoPrice(tradeMetrics.tp2)}
                    </p>
                    <span className="text-[10px] text-purple-300/70">
                      Trail Remaining Runner Position
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. UPGRADE 3: ORDER BOOK DEPTH CHART */}
              <DepthChart
                symbol={signal.symbol}
                midPrice={tradeMetrics.entryHigh}
                wallPrice={signal.wall_price}
                wallUsd={signal.wall_usd}
                height={195}
              />

              {/* 5. MARKET FLOW & SMART MONEY CONCEPTS */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Order Flow & Smart Money Concepts (SMC)
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Relative Volume (RVOL)</span>
                      <span className="font-mono text-sm font-bold text-cyan-300">
                        {(signal.volume_ratio ?? 2.1).toFixed(1)}x avg
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{
                          width: `${Math.min(100, ((signal.volume_ratio ?? 2.0) / 5) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Taker Buy Aggression</span>
                      <span
                        className={`font-mono text-sm font-bold ${
                          takerBuyPct >= 60 ? "text-emerald-400" : "text-amber-300"
                        }`}
                      >
                        {takerBuyPct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        style={{ width: `${Math.min(100, Math.max(0, takerBuyPct))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center ${
                      signal.smc_bos
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700/50 bg-slate-900/40 text-slate-500"
                    }`}
                  >
                    {signal.smc_bos ? (
                      <CheckCircle2 className="mb-1 h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="mb-1 h-4 w-4 text-slate-500" />
                    )}
                    <span className="text-[11px] font-bold">BoS Confirmed</span>
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center ${
                      signal.smc_ob
                        ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                        : "border-slate-700/50 bg-slate-900/40 text-slate-500"
                    }`}
                  >
                    {signal.smc_ob ? (
                      <Sparkles className="mb-1 h-4 w-4 text-purple-400" />
                    ) : (
                      <XCircle className="mb-1 h-4 w-4 text-slate-500" />
                    )}
                    <span className="text-[11px] font-bold">Order Block (OB)</span>
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center ${
                      signal.smc_retest
                        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                        : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {signal.smc_retest ? (
                      <CheckCircle2 className="mb-1 h-4 w-4 text-cyan-400" />
                    ) : (
                      <Clock className="mb-1 h-4 w-4 text-amber-400" />
                    )}
                    <span className="text-[11px] font-bold">Neckline Retest</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. FOOTER ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-700/50 bg-[#06080E] px-6 py-4">
              <Link
                href={`/coin/${encodeURIComponent(signal.symbol.trim().toUpperCase())}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/25 hover:text-white"
              >
                <span>Coin Deep-Dive Page</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              <a
                href={`https://dexscreener.com/search?q=${encodeURIComponent(
                  signal.symbol.trim()
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-3 text-xs font-bold text-emerald-300 transition hover:border-emerald-400 hover:text-white"
              >
                <span>Open on DexScreener</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <button
                onClick={async () => {
                  await onBlacklist(signal.symbol.trim());
                  onClose();
                }}
                disabled={isBlacklisting}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-bold text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/25 hover:text-white disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                <span>{isBlacklisting ? "Banning..." : "Blacklist"}</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}