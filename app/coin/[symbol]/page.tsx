// app/coin/[symbol]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react"; // <-- Suspense import kiya
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CoinDetailData,
  formatCryptoPrice,
  formatPatternName,
  formatRelativeTime,
} from "@/types/types";
import TradingChart from "@/components/TradingChart";
import DepthChart from "@/components/DepthChart";
import {
  ArrowLeft,
  ExternalLink,
  Ban,
  Trophy,
  Zap,
  Shield,
  CheckCircle2,
  AlertTriangle,
  History,
  Layers,
  Activity,
  Sparkles,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Generates realistic Coin Detail fallback data for any symbol clicked
function buildFallbackCoinDetail(symbol: string): CoinDetailData {
  const sym = symbol.toUpperCase();
  const seedPrice =
    sym === "PHAROS"
      ? 0.634166
      : sym === "DOS"
      ? 0.2995
      : sym === "GRASS"
      ? 0.6952
      : sym === "FHE"
      ? 0.0189282
      : 0.04825;

  return {
    symbol: sym,
    current_price: seedPrice,
    change_24h_pct: 11.4,
    win_rate_pct: 78.5,
    total_signals: 14,
    active_walls_count: 3,
    respect_rate_pct: 82,
    signals: [
      {
        id: 1,
        symbol: sym,
        structure: "double_bottom",
        timeframe: "4h",
        confidence: 88,
        p1_volume_score: 21,
        p2_wall_score: 23,
        p3_structure_score: 34,
        p4_btc_score: 10,
        entry_low: Number((seedPrice * 0.992).toPrecision(6)),
        entry_high: seedPrice,
        stop_loss: Number((seedPrice * 0.968).toPrecision(6)),
        tp1_price: Number((seedPrice * 1.045).toPrecision(6)),
        tp2_price: Number((seedPrice * 1.082).toPrecision(6)),
        volume_ratio: 3.4,
        taker_buy_ratio: 0.71,
        smc_bos: true,
        smc_ob: true,
        is_extended: false,
        detected_at: new Date(Date.now() - 18 * 60000).toISOString(),
      },
      {
        id: 2,
        symbol: sym,
        structure: "cup_and_handle",
        timeframe: "1h",
        confidence: 79,
        p1_volume_score: 18,
        p2_wall_score: 20,
        p3_structure_score: 31,
        p4_btc_score: 10,
        entry_low: Number((seedPrice * 0.955).toPrecision(6)),
        entry_high: Number((seedPrice * 0.962).toPrecision(6)),
        stop_loss: Number((seedPrice * 0.935).toPrecision(6)),
        tp1_price: Number((seedPrice * 1.01).toPrecision(6)),
        tp2_price: Number((seedPrice * 1.038).toPrecision(6)),
        volume_ratio: 2.6,
        taker_buy_ratio: 0.64,
        smc_bos: true,
        smc_ob: false,
        is_extended: false,
        detected_at: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
      {
        id: 3,
        symbol: sym,
        structure: "ascending_triangle",
        timeframe: "15m",
        confidence: 66,
        p1_volume_score: 16,
        p2_wall_score: 15,
        p3_structure_score: 25,
        p4_btc_score: 10,
        entry_low: Number((seedPrice * 0.92).toPrecision(6)),
        entry_high: Number((seedPrice * 0.93).toPrecision(6)),
        stop_loss: Number((seedPrice * 0.902).toPrecision(6)),
        tp1_price: Number((seedPrice * 0.96).toPrecision(6)),
        tp2_price: Number((seedPrice * 0.985).toPrecision(6)),
        volume_ratio: 2.1,
        taker_buy_ratio: 0.58,
        smc_bos: false,
        smc_ob: true,
        is_extended: true,
        detected_at: new Date(Date.now() - 19 * 3600000).toISOString(),
      },
    ],
    wall_history: [
      {
        id: 501,
        exchange: "binance_alpha",
        price: Number((seedPrice * 0.991).toPrecision(6)),
        usd_value: 54200,
        status: "ACTIVE",
        respect_rate: 84,
        detected_at: new Date(Date.now() - 6 * 60000).toISOString(),
      },
      {
        id: 502,
        exchange: "kucoin",
        price: Number((seedPrice * 0.982).toPrecision(6)),
        usd_value: 31800,
        status: "HELD",
        respect_rate: 84,
        detected_at: new Date(Date.now() - 75 * 60000).toISOString(),
      },
      {
        id: 503,
        exchange: "binance_alpha",
        price: Number((seedPrice * 0.965).toPrecision(6)),
        usd_value: 19400,
        status: "HELD",
        respect_rate: 79,
        detected_at: new Date(Date.now() - 190 * 60000).toISOString(),
      },
      {
        id: 504,
        exchange: "mexc",
        price: Number((seedPrice * 0.974).toPrecision(6)),
        usd_value: 14200,
        status: "PULLED",
        respect_rate: 45,
        detected_at: new Date(Date.now() - 320 * 60000).toISOString(),
      },
    ],
     ohlc: [],     // <--- YEH LINE ADD KAREIN
      depth: [],    // <--- YEH LINE ADD KAREIN
    } as any;       // <--- YEH LINE CHANGE KAREIN (Pehle sirf }; tha)
  };


// 1. YAHAN FUNCTION KA NAAM CHANGE KAREIN (CoinDetailContent)
function CoinDetailContent() {
  const params = useParams();
  const router = useRouter();
  const rawSymbol = Array.isArray(params?.symbol) ? params.symbol[0] : params?.symbol || "BTC";
  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();

  const [coinData, setCoinData] = useState<CoinDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"signals" | "walls">("signals");
  const [isBlacklisting, setIsBlacklisting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchCoinDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/coin/${encodeURIComponent(symbol)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Fallback to synthesized coin profile");
      const data: CoinDetailData = await res.json();
      setCoinData(data);
    } catch {
      setCoinData(buildFallbackCoinDetail(symbol));
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchCoinDetails();
  }, [fetchCoinDetails]);

  const handleBlacklistCoin = async () => {
    setIsBlacklisting(true);
    try {
      await fetch(`${API_BASE_URL}/api/dashboard/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
    } catch {
      // Optimistic fallback
    } finally {
      setIsBlacklisting(false);
      setToastMsg(`🚫 ${symbol} added to global blacklist`);
      setTimeout(() => router.push("/"), 1400);
    }
  };

  const primarySignal = useMemo(() => {
    if (!coinData || coinData.signals.length === 0) return null;
    return coinData.signals[0];
  }, [coinData]);

  const wallStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
      case "HELD":
        return "border-cyan-500/40 bg-cyan-500/15 text-cyan-300";
      case "PULLED":
        return "border-amber-500/40 bg-amber-500/15 text-amber-300";
      default:
        return "border-rose-500/40 bg-rose-500/15 text-rose-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] pb-20 text-slate-100">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/[0.06] blur-[140px]" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-cyan-500/[0.06] blur-[140px]" />
      </div>

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-700/50 bg-[#07090E]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/40 text-slate-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300"
              title="Back to Main Terminal"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {symbol} <span className="text-sm font-normal text-slate-400">/ USDT</span>
                </h1>

                {coinData && (
                  <span className="font-mono text-lg font-extrabold text-emerald-400">
                    ${formatCryptoPrice(coinData.current_price)}
                  </span>
                )}

                {coinData && (
                  <span
                    className={`rounded-lg border px-2 py-0.5 font-mono text-xs font-bold ${
                      coinData.change_24h_pct >= 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {coinData.change_24h_pct >= 0 ? "+" : ""}
                    {coinData.change_24h_pct.toFixed(2)}% (24H)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Institutional Token Deep-Dive • Historical 4-Pillar Signals & L2 Whale Wall Audit
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`https://dexscreener.com/search?q=${encodeURIComponent(symbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 hover:text-white"
            >
              <span>DexScreener Chart</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={handleBlacklistCoin}
              disabled={isBlacklisting}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25 hover:text-white disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>{isBlacklisting ? "Blacklisting..." : "Blacklist Coin"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative mx-auto max-w-[1500px] space-y-6 px-6 py-6">
        {isLoading || !coinData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/40"
                />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/40" />
          </div>
        ) : (
          <>
            {/* 1. COIN KPIs (3 Cards) */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {/* Card 1: Coin-Specific Win Rate */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {symbol} Win Rate
                    </p>
                    <h3 className="mt-2 font-mono text-3xl font-black text-emerald-400">
                      {coinData.win_rate_pct.toFixed(1)}%
                    </h3>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <Trophy className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Historical percentage of {symbol} breakouts hitting TP1 (+1.5R)
                </p>
              </div>

              {/* Card 2: Total Signals */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Total Signals Logged
                    </p>
                    <h3 className="mt-2 font-mono text-3xl font-black text-white">
                      {coinData.total_signals}
                    </h3>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Confirmed 4-Pillar setups across 15m, 1h, and 4h timeframes
                </p>
              </div>

              {/* Card 3: Active Walls & Respect Rate */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Active Bid Walls
                    </p>
                    <div className="mt-2 flex items-baseline gap-2.5">
                      <h3 className="font-mono text-3xl font-black text-cyan-400">
                        {coinData.active_walls_count}
                      </h3>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                        {coinData.respect_rate_pct}% Respected
                      </span>
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                    <Shield className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Live order book whale clusters currently supporting price
                </p>
              </div>
            </div>

            {/* 2. CHARTS ROW: TradingView Candlestick Chart + Order Book Depth Chart */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <TradingChart
                  symbol={symbol}
                  timeframe={primarySignal?.timeframe || "4h"}
                  entryPrice={primarySignal?.entry_high || coinData.current_price}
                  stopLoss={primarySignal?.stop_loss || coinData.current_price * 0.968}
                  tp1Price={primarySignal?.tp1_price || coinData.current_price * 1.045}
                  tp2Price={primarySignal?.tp2_price || coinData.current_price * 1.08}
                  candles={coinData.ohlc}
                  height={280}
                />
              </div>
              <div className="lg:col-span-5">
                <DepthChart
                  symbol={symbol}
                  midPrice={coinData.current_price}
                  wallPrice={coinData.wall_history[0]?.price}
                  wallUsd={coinData.wall_history[0]?.usd_value}
                  depthData={coinData.depth}
                  height={280}
                />
              </div>
            </div>

            {/* 3. FRAMER MOTION TABS: Signal History vs Wall History */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-xl">
              {/* Tab Bar */}
              <div className="flex items-center gap-2 border-b border-slate-700/50 px-6 pt-4">
                <button
                  onClick={() => setActiveTab("signals")}
                  className={`relative flex items-center gap-2 px-4 pb-3.5 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === "signals" ? "text-cyan-300" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  <span>Signal History ({coinData.signals.length})</span>
                  {activeTab === "signals" && (
                    <motion.div
                      layoutId="coinTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-emerald-400"
                    />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("walls")}
                  className={`relative flex items-center gap-2 px-4 pb-3.5 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === "walls" ? "text-emerald-300" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>Wall History ({coinData.wall_history.length})</span>
                  {activeTab === "walls" && (
                    <motion.div
                      layoutId="coinTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400"
                    />
                  )}
                </button>
              </div>

              {/* Animated Tab Panels */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {activeTab === "signals" ? (
                    <motion.div
                      key="signals-tab"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-x-auto"
                    >
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="py-3 pl-4">Time</th>
                            <th className="px-3 py-3">Pattern & SMC</th>
                            <th className="px-3 py-3">Timeframe</th>
                            <th className="px-3 py-3">4-Pillar Score</th>
                            <th className="px-3 py-3">Entry</th>
                            <th className="px-3 py-3">Stop Loss</th>
                            <th className="px-3 py-3">TP1 Target</th>
                            <th className="py-3 pr-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/40">
                          {coinData.signals.map((sig, i) => (
                            <tr
                              key={sig.id || i}
                              className="transition hover:bg-white/[0.03]"
                            >
                              <td className="py-3.5 pl-4 font-mono text-slate-300">
                                {formatRelativeTime(sig.detected_at)}
                              </td>
                              <td className="px-3 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">
                                    {formatPatternName(sig.structure)}
                                  </span>
                                  {sig.smc_bos && (
                                    <span className="inline-flex items-center gap-0.5 rounded border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300">
                                      <Sparkles className="h-2.5 w-2.5" /> BoS
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3.5">
                                <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-slate-300">
                                  {sig.timeframe}
                                </span>
                              </td>
                              <td className="px-3 py-3.5 font-mono font-bold text-cyan-300">
                                {sig.confidence.toFixed(0)} / 100
                              </td>
                              <td className="px-3 py-3.5 font-mono text-slate-200">
                                ${formatCryptoPrice(sig.entry_high || sig.breakout_price)}
                              </td>
                              <td className="px-3 py-3.5 font-mono text-rose-400">
                                ${formatCryptoPrice(sig.stop_loss)}
                              </td>
                              <td className="px-3 py-3.5 font-mono font-bold text-emerald-400">
                                ${formatCryptoPrice(sig.tp1_price)}
                              </td>
                              <td className="py-3.5 pr-4 text-right">
                                {sig.is_extended ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                                    <AlertTriangle className="h-3 w-3" /> Extended
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" /> Ready
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="walls-tab"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
                    >
                      {coinData.wall_history.map((w) => (
                        <div
                          key={w.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-emerald-400" />
                              <span className="font-mono text-base font-black text-white">
                                ${w.usd_value.toLocaleString()}
                              </span>
                              <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-300">
                                {w.exchange.replace("_", " ")}
                              </span>
                            </div>

                            <span
                              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${wallStatusBadge(
                                w.status
                              )}`}
                            >
                              {w.status}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>
                              Wall Level:{" "}
                              <strong className="font-mono text-cyan-300">
                                ${formatCryptoPrice(w.price)}
                              </strong>
                            </span>
                            <span>{formatRelativeTime(w.detected_at)}</span>
                          </div>

                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Respect Rate</span>
                              <span className="font-mono font-bold text-emerald-300">
                                {w.respect_rate}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                                style={{ width: `${Math.min(100, w.respect_rate)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-rose-500/40 bg-[#0B0F19]/95 px-4 py-3 text-xs font-bold text-rose-300 shadow-2xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// 2. YAHAN NAYA DEFAULT EXPORT ADD KAREIN (Suspense Ke Sath)
export default function CoinDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center text-cyan-400">
        <div className="h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold tracking-wider">LOADING COIN DATA...</p>
      </div>
    }>
      <CoinDetailContent />
    </Suspense>
  );
}