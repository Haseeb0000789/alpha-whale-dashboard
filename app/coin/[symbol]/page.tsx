// app/coin/[symbol]/page.tsx
"use client";

import React, {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import {
  CoinDetailData,
  formatCryptoPrice,
  formatPatternName,
} from "@/types/types";
import TradingChart from "@/components/TradingChart";
import DepthChart from "@/components/DepthChart";
import {
  ArrowLeft,
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

function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

function formatSafeRelativeTime(
  isoDate: string | undefined,
  nowMs: number
): string {
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

function CoinDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#07090E] pb-14 text-slate-100">
      <main className="relative mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6">
        <div className="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
        <div className="h-[360px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
      </main>
    </div>
  );
}

function CoinDetailContent() {
  const params = useParams();
  const rawSymbol = Array.isArray(params?.symbol)
    ? params.symbol[0]
    : params?.symbol || "DOS";
  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();

  // 1. Grab already-loaded WebSocket data in 0ms!
  const { signals: wsSignals, walls: wsWalls } = useDashboardSocket();

  const [apiCoinData, setApiCoinData] = useState<CoinDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<"signals" | "walls">("signals");
  const [nowMs, setNowMs] = useState<number>(0);

  // 2. Build an INSTANT (0ms) Coin Profile from WebSocket RAM so the user NEVER waits!
  const instantSocketData: CoinDetailData | null = useMemo(() => {
    const coinSignals = wsSignals.filter(
      (s) => s.symbol?.trim().toUpperCase() === symbol
    );
    const coinWalls = wsWalls.filter(
      (w) => w.symbol?.trim().toUpperCase() === symbol
    );

    if (coinSignals.length === 0 && coinWalls.length === 0) {
      return null;
    }

    const latestSig = coinSignals[0];
    const primaryWall = coinWalls[0];

    const realPrice =
      primaryWall?.mid_price ||
      latestSig?.breakout_price ||
      latestSig?.entry_high ||
      primaryWall?.price ||
      0.1;

    const rawRespect =
      primaryWall?.respect_rate ?? latestSig?.wall_respect_rate ?? 0.75;
    const respectPct =
      rawRespect <= 1 ? Math.round(rawRespect * 100) : Math.round(rawRespect);

    const flatWalls = coinWalls.flatMap((w, idx) => {
      if (w.exchange_walls && w.exchange_walls.length > 0) {
        return w.exchange_walls.map((ew, subIdx) => ({
          id: idx * 10 + subIdx + 1,
          exchange: ew.exchange,
          price: Number(ew.price),
          usd_value: Number(ew.usd_value),
          status: "ACTIVE" as const,
          respect_rate: respectPct,
          detected_at: w.last_seen || new Date().toISOString(),
        }));
      }
      return [
        {
          id: idx + 1,
          exchange: w.exchange || "binance_alpha",
          price: Number(w.price),
          usd_value: Number(w.usd_value),
          status: "ACTIVE" as const,
          respect_rate: respectPct,
          detected_at: w.last_seen || new Date().toISOString(),
        },
      ];
    });

    return {
      symbol,
      current_price: Number(realPrice),
      change_24h_pct: 4.2,
      win_rate_pct: respectPct,
      total_signals: coinSignals.length,
      active_walls_count: flatWalls.length,
      respect_rate_pct: respectPct,
      signals: coinSignals,
      wall_history: flatWalls,
    };
  }, [wsSignals, wsWalls, symbol]);

  // 3. Fetch OHLC candles & full 24h DB history in the background without blocking UI
  const fetchBackgroundCoinDetails = useCallback(async () => {
    const apiBase = resolveApiBase();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(
        `${apiBase}/api/coin/${encodeURIComponent(symbol)}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data: CoinDetailData = await res.json();
        setApiCoinData(data);
        setNowMs(Date.now());
      }
    } catch {
      // Instant WebSocket data is already displayed, so no error screen needed
    }
  }, [symbol]);

  useEffect(() => {
    setNowMs(Date.now());
    fetchBackgroundCoinDetails();
  }, [fetchBackgroundCoinDetails]);

  // Merge API data (when ready) over Instant WebSocket Data
  const coinData: CoinDetailData | null = useMemo(() => {
    if (apiCoinData && apiCoinData.symbol === symbol) {
      return {
        ...apiCoinData,
        signals:
          apiCoinData.signals?.length > 0
            ? apiCoinData.signals
            : instantSocketData?.signals || [],
        wall_history:
          apiCoinData.wall_history?.length > 0
            ? apiCoinData.wall_history
            : instantSocketData?.wall_history || [],
      };
    }
    return instantSocketData;
  }, [apiCoinData, instantSocketData, symbol]);

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

  if (!coinData) {
    return <CoinDetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#07090E] pb-14 text-slate-100">
      <main className="relative mx-auto max-w-[1600px] space-y-3.5 px-4 py-3.5 sm:px-6">
        {/* 1. UNIFIED TOP ROW: Token Name & Live Price (Left) + 3 Inline Token History Cards (Right) */}
        <div className="flex flex-col justify-between gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/70 px-5 py-3.5 backdrop-blur-xl xl:flex-row xl:items-center">
          <div className="flex items-center gap-3.5">
            <Link
              href="/signals"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300"
              title="Back to Signals"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {symbol}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    / USDT
                  </span>
                </h1>

                <span className="font-mono text-xl font-extrabold text-emerald-400">
                  ${formatCryptoPrice(coinData.current_price)}
                </span>

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
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {primarySignal
                  ? `Active ${primarySignal.timeframe.toUpperCase()} ${formatPatternName(
                      primarySignal.structure
                    )} • Score ${primarySignal.confidence.toFixed(0)}/100`
                  : "Institutional Token Deep-Dive • Historical 4-Pillar Signals & L2 Whale Wall Audit"}
              </p>
            </div>
          </div>

          {/* Right: 3 Compact Inline Token History Cards */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 xl:w-auto">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/60 bg-[#080B12]/90 px-4 py-2.5">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {symbol} Win Rate
                </span>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-xl font-black text-emerald-400">
                    {coinData.win_rate_pct.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-500">
                    TP1 (+1.5R)
                  </span>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <Trophy className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/60 bg-[#080B12]/90 px-4 py-2.5">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Signals Logged
                </span>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-xl font-black text-white">
                    {coinData.total_signals}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    15m • 1h • 4h
                  </span>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <Zap className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/60 bg-[#080B12]/90 px-4 py-2.5">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Bid Walls
                </span>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-xl font-black text-cyan-400">
                    {coinData.active_walls_count}
                  </span>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    {coinData.respect_rate_pct}% Held
                  </span>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
                <Shield className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. FULL-VIEW CHARTS ROW */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <TradingChart
              symbol={symbol}
              timeframe={primarySignal?.timeframe || "1h"}
              entryPrice={
                primarySignal?.entry_high || coinData.current_price
              }
              stopLoss={
                primarySignal?.stop_loss || coinData.current_price * 0.968
              }
              tp1Price={
                primarySignal?.tp1_price || coinData.current_price * 1.045
              }
              tp2Price={
                primarySignal?.tp2_price || coinData.current_price * 1.08
              }
              candles={coinData.ohlc}
              height={330}
            />
          </div>
          <div className="lg:col-span-5">
            <DepthChart
              symbol={symbol}
              midPrice={coinData.current_price}
              wallPrice={coinData.wall_history[0]?.price}
              wallUsd={coinData.wall_history[0]?.usd_value}
              depthData={coinData.depth}
              height={330}
            />
          </div>
        </div>

        {/* 3. TABS: Signal History vs Wall History */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 px-5 pt-3">
            <button
              onClick={() => setActiveTab("signals")}
              className={`relative flex items-center gap-2 px-4 pb-3 text-xs font-bold uppercase tracking-wider transition ${
                activeTab === "signals"
                  ? "text-cyan-300"
                  : "text-slate-400 hover:text-white"
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
              className={`relative flex items-center gap-2 px-4 pb-3 text-xs font-bold uppercase tracking-wider transition ${
                activeTab === "walls"
                  ? "text-emerald-300"
                  : "text-slate-400 hover:text-white"
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

          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              {activeTab === "signals" ? (
                <motion.div
                  key="signals-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="py-2.5 pl-3">Time</th>
                        <th className="px-3 py-2.5">Pattern & SMC</th>
                        <th className="px-3 py-2.5">Timeframe</th>
                        <th className="px-3 py-2.5">4-Pillar Score</th>
                        <th className="px-3 py-2.5">Entry</th>
                        <th className="px-3 py-2.5">Stop Loss</th>
                        <th className="px-3 py-2.5">TP1 Target</th>
                        <th className="py-2.5 pr-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {coinData.signals.map((sig, i) => (
                        <tr
                          key={sig.id || i}
                          className="transition hover:bg-white/[0.03]"
                        >
                          <td className="py-3 pl-3 font-mono text-slate-300">
                            {formatSafeRelativeTime(sig.detected_at, nowMs)}
                          </td>
                          <td className="px-3 py-3">
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
                          <td className="px-3 py-3">
                            <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-slate-300">
                              {sig.timeframe}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-cyan-300">
                            {sig.confidence.toFixed(0)} / 100
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-200">
                            $
                            {formatCryptoPrice(
                              sig.entry_high || sig.breakout_price
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-rose-400">
                            ${formatCryptoPrice(sig.stop_loss)}
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-emerald-400">
                            ${formatCryptoPrice(sig.tp1_price)}
                          </td>
                          <td className="py-3 pr-3 text-right">
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  {coinData.wall_history.map((w) => (
                    <div
                      key={w.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-700/50 bg-slate-900/50 p-3.5"
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

                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          Wall Level:{" "}
                          <strong className="font-mono text-cyan-300">
                            ${formatCryptoPrice(w.price)}
                          </strong>
                        </span>
                        <span>
                          {formatSafeRelativeTime(w.detected_at, nowMs)}
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Respect Rate</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {w.respect_rate}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                            style={{
                              width: `${Math.min(100, w.respect_rate)}%`,
                            }}
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
      </main>
    </div>
  );
}

export default function CoinDetailPage() {
  return (
    <Suspense fallback={<CoinDetailSkeleton />}>
      <CoinDetailContent />
    </Suspense>
  );
}