// components/WallTable.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BidWall, formatCryptoPrice } from "@/types/types";
import { WallCardsSkeleton } from "./Skeletons";
import {
  Shield,
  ArrowUpDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Trophy,
} from "lucide-react";

interface WallTableProps {
  walls: BidWall[];
  isLoading: boolean;
  onSelectSymbol?: (symbol: string) => void;
  onBlacklist?: (symbol: string) => Promise<void>;
}

type SortKey = "relevance" | "usd_value" | "proximity" | "respect_rate";

// ---------------------------------------------------------------------------
// FIX #1: moved ABOVE the component so useMemo sort can use it safely
// Handles mixed backends: 0.75 (fraction) → 75 (percent), 75 → 75
// ---------------------------------------------------------------------------
function normalizeRespectPct(raw?: number): number {
  if (raw === undefined || raw === null) return 75;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function formatSafeRelativeTime(isoDate: string | undefined, nowMs: number): string {
  if (!isoDate || nowMs <= 0) return "0s ago";
  const dateMs = new Date(isoDate).getTime();
  if (isNaN(dateMs)) return "0s ago";
  const diffSeconds = Math.max(0, Math.floor((nowMs - dateMs) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function WallTable({
  walls,
  isLoading,
  onSelectSymbol,
}: WallTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    setNowMs(Date.now());
  }, [walls]);

  const sortedWalls = useMemo(() => {
    const map = new Map<string, BidWall>();
    for (const w of walls) {
      const cleanSym = w.symbol.trim().toUpperCase();
      const existing = map.get(cleanSym);
      if (
        !existing ||
        (w.relevance_score ?? 0) > (existing.relevance_score ?? 0) ||
        w.usd_value > existing.usd_value
      ) {
        map.set(cleanSym, w);
      }
    }

    const list = Array.from(map.values());
    return list.sort((a, b) => {
      // 1. Relevance — highest score first, then tightest distance
      if (sortKey === "relevance") {
        const relA = a.relevance_score ?? a.entry_score ?? 50;
        const relB = b.relevance_score ?? b.entry_score ?? 50;
        if (relB !== relA) return relB - relA;
        return (a.distance_pct ?? 1) - (b.distance_pct ?? 1);
      }

      // 2. Proximity — closest wall to mid-price first
      if (sortKey === "proximity") {
        return (a.distance_pct ?? 99) - (b.distance_pct ?? 99);
      }

      // 3. Size — biggest USD wall first
      if (sortKey === "usd_value") {
        return b.usd_value - a.usd_value;
      }

      // 4. FIX #2: Respect % — highest respected first (100% → 80% → ... → 0%)
      //    Tie-breaker: larger USD wall wins
      const respDiff =
        normalizeRespectPct(b.respect_rate) -
        normalizeRespectPct(a.respect_rate);
      if (respDiff !== 0) return respDiff;
      return b.usd_value - a.usd_value;
    });
  }, [walls, sortKey]);

  const formatExchange = (ex: string) =>
    (ex || "binance_alpha").replace("_", " ").toUpperCase();

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/60 shadow-2xl backdrop-blur-xl">
      {/* Compact Single-Line Header + Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">
              Live Whale Bid Walls
            </h2>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
              {sortedWalls.length} Active
            </span>
          </div>
        </div>

        {/* Sort Pills on the Right */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-700/60 bg-[#07090E]/90 p-1 text-[11px]">
          <ArrowUpDown className="ml-1.5 mr-1 h-3 w-3 text-slate-400" />
          <button
            onClick={() => setSortKey("relevance")}
            className={`rounded-lg px-2 py-1 font-bold transition ${
              sortKey === "relevance"
                ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔥 Relevant
          </button>
          <button
            onClick={() => setSortKey("proximity")}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              sortKey === "proximity"
                ? "border border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Closest %
          </button>
          <button
            onClick={() => setSortKey("usd_value")}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              sortKey === "usd_value"
                ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Size ($)
          </button>
          <button
            onClick={() => setSortKey("respect_rate")}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              sortKey === "respect_rate"
                ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Respect %
          </button>
        </div>
      </div>

      {/* Scrollable Telegram-Synced Wall Cards */}
      <div className="max-h-[calc(100vh-215px)] space-y-3 overflow-y-auto p-3.5 scrollbar-thin scrollbar-thumb-slate-800">
        {isLoading && sortedWalls.length === 0 ? (
          <WallCardsSkeleton count={4} />
        ) : sortedWalls.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500">
            <Layers className="mx-auto mb-2 h-7 w-7 opacity-40" />
            No active bid walls detected right now.
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedWalls.map((wall) => {
              const cleanSym = wall.symbol.trim().toUpperCase();
              const respectPct = normalizeRespectPct(wall.respect_rate);
              const entryScore = wall.entry_score ?? 58;
              const distPct = wall.distance_pct ?? 0.45;
              const midPrice = wall.mid_price || wall.price * (1 + distPct / 100);
              const seenIso = wall.last_seen || wall.last_seen_at;

              const exWalls =
                wall.exchange_walls && wall.exchange_walls.length > 0
                  ? wall.exchange_walls
                  : [
                      {
                        exchange: wall.exchange,
                        price: wall.price,
                        usd_value: wall.usd_value,
                        distance_pct: distPct,
                      },
                    ];

              const positives =
                wall.positives && wall.positives.length > 0
                  ? wall.positives
                  : [
                      distPct <= 0.8
                        ? `Tight Proximity (-${distPct.toFixed(2)}%)`
                        : `Active Bid Support`,
                      wall.scans_seen && wall.scans_seen >= 2
                        ? `Persistent (${wall.scans_seen} scans held)`
                        : `Ask Vacuum Detected`,
                    ];

              const warnings =
                wall.warnings && wall.warnings.length > 0
                  ? wall.warnings
                  : respectPct < 45
                  ? [`Frequent Spoof/Break History (${respectPct}% respect)`]
                  : [];

              return (
                <motion.div
                  key={cleanSym}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => onSelectSymbol && onSelectSymbol(cleanSym)}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border p-3.5 transition-all ${
                    entryScore >= 60 || distPct <= 0.5
                      ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.11] via-slate-900/95 to-[#090D16] hover:border-emerald-400/70"
                      : "border-slate-700/60 bg-slate-900/70 hover:border-cyan-500/40"
                  }`}
                >
                  {/* Top Header: Symbol + Mid Price (Left) & Trophy Score + Proximity (Right) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>

                      <Link
                        href={`/coin/${encodeURIComponent(cleanSym)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-base font-black tracking-tight text-white transition hover:text-cyan-300 hover:underline"
                      >
                        <span>🐋 {cleanSym}/USDT</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400" />
                      </Link>

                      <span className="font-mono text-xs font-bold text-slate-300">
                        — ${formatCryptoPrice(midPrice)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 font-mono text-xs font-extrabold text-amber-300">
                        <Trophy className="h-3 w-3 text-amber-400" />
                        {entryScore}/100
                      </span>

                      <span
                        className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold ${
                          distPct <= 0.5
                            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                            : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                        }`}
                      >
                        -{distPct.toFixed(2)}% away
                      </span>
                    </div>
                  </div>

                  {/* Per-Exchange Breakdown */}
                  <div className="mt-2.5 space-y-1 rounded-xl border border-white/[0.05] bg-black/35 px-3 py-2 font-mono text-xs">
                    {exWalls.map((ew, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 text-slate-200"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400">•</span>
                          <span className="font-sans text-xs font-bold text-white">
                            {formatExchange(ew.exchange)}:
                          </span>
                          <span className="font-bold text-emerald-400">
                            ${ew.usd_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-cyan-300">
                            @ ${formatCryptoPrice(ew.price)}
                          </span>{" "}
                          <span className="text-slate-400">
                            (-{(ew.distance_pct ?? distPct).toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    ))}

                    {exWalls.length > 1 && (
                      <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-xs font-bold text-amber-300">
                        <span>💰 Total Combined Bid Wall:</span>
                        <span>
                          ${wall.usd_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Positives (✅) & Spoof Warnings (⚠️) */}
                  <div className="mt-2.5 space-y-1.5 text-xs">
                    {positives.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1.5 text-emerald-300">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="font-medium leading-snug">
                          {positives.join(" • ")}
                        </span>
                      </div>
                    )}

                    {warnings.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1.5 text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="font-medium leading-snug">
                          {warnings.join(" • ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer: Respect Rate Bar & Seen Time */}
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        7D Historical Respect Rate:{" "}
                        <strong
                          className={`font-mono ${
                            respectPct >= 60 ? "text-emerald-300" : "text-amber-300"
                          }`}
                        >
                          {respectPct}% respected
                        </strong>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatSafeRelativeTime(seenIso, nowMs)}
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                      <div
                        style={{ width: `${Math.min(100, Math.max(10, respectPct))}%` }}
                        className={`h-full rounded-full ${
                          respectPct >= 65
                            ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                            : respectPct >= 40
                            ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                            : "bg-gradient-to-r from-rose-500 to-orange-500"
                        }`}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}