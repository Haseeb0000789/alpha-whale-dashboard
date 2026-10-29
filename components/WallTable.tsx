// components/WallTable.tsx
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BidWall, formatCryptoPrice, formatRelativeTime } from "@/types/types";
import { WallCardsSkeleton } from "./Skeletons";
import {
  Shield,
  ArrowUpDown,
  Flame,
  Trash2,
  Layers,
  CheckCircle2,
  Zap,
} from "lucide-react";

interface WallTableProps {
  walls: BidWall[];
  isLoading: boolean;
  onSelectSymbol?: (symbol: string) => void;
  onBlacklist: (symbol: string) => Promise<void>;
}

type SortKey = "usd_value" | "respect_rate" | "last_seen";

export default function WallTable({
  walls,
  isLoading,
  onSelectSymbol,
  onBlacklist,
}: WallTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("usd_value");
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);

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

  const sortedWalls = useMemo(() => {
    const map = new Map<string, BidWall>();
    for (const w of walls) {
      const cleanSym = w.symbol.trim().toUpperCase();
      const k = `${cleanSym}-${w.exchange}-${Number(w.price).toPrecision(6)}`;
      const existing = map.get(k);
      if (!existing || w.usd_value > existing.usd_value) {
        map.set(k, w);
      }
    }

    const list = Array.from(map.values());
    return list.sort((a, b) => {
      if (sortKey === "usd_value") return b.usd_value - a.usd_value;
      if (sortKey === "respect_rate") {
        return (b.respect_rate ?? 0.75) - (a.respect_rate ?? 0.75);
      }
      const timeA = new Date(a.last_seen || a.last_seen_at || 0).getTime();
      const timeB = new Date(b.last_seen || b.last_seen_at || 0).getTime();
      return timeB - timeA;
    });
  }, [walls, sortKey]);

  const formatExchange = (ex: string) =>
    (ex || "binance_alpha").replace("_", " ").toUpperCase();

  const normalizeRespectPct = (raw?: number) => {
    if (raw === undefined || raw === null) return 75;
    return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/85 to-[#0B0F17]/95 shadow-2xl backdrop-blur-xl">
      {/* Header & Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                Live Whale Bid Walls
              </h2>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                {sortedWalls.length} Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real-time L2 order book support & historical hold rate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#07090E]/90 p-1 text-[11px]">
          <ArrowUpDown className="ml-1.5 mr-1 h-3 w-3 text-slate-400" />
          <button
            onClick={() => setSortKey("usd_value")}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              sortKey === "usd_value"
                ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Size ($)
          </button>
          <button
            onClick={() => setSortKey("respect_rate")}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              sortKey === "respect_rate"
                ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Respect %
          </button>
        </div>
      </div>

      {/* Scrollable Telegram-Style Wall Cards List */}
      <div className="max-h-[620px] space-y-3 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Upgrade 5: Sleek Wall Card Skeleton Loader */}
        {isLoading && sortedWalls.length === 0 ? (
          <WallCardsSkeleton count={4} />
        ) : sortedWalls.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500">
            <Layers className="mx-auto mb-2 h-7 w-7 opacity-40" />
            No active bid walls detected right now.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {sortedWalls.map((wall) => {
              const cleanSym = wall.symbol.trim().toUpperCase();
              const isMegaWhale = wall.usd_value > 50000;
              const isSharkWall = wall.usd_value > 10000 && wall.usd_value <= 50000;
              const respectPct = normalizeRespectPct(wall.respect_rate);
              const seenIso = wall.last_seen || wall.last_seen_at;
              const isBeingRemoved = removingSymbol === cleanSym;

              return (
                <motion.div
                  layout
                  key={`${cleanSym}-${wall.exchange}-${wall.price}`}
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: isBeingRemoved ? 0.35 : 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, scale: 0.92 }}
                  transition={{ duration: 0.22 }}
                  onClick={() => onSelectSymbol && onSelectSymbol(cleanSym)}
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all ${
                    isMegaWhale
                      ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.12] via-slate-900/90 to-[#090D16] shadow-[0_0_25px_rgba(16,185,129,0.12)] hover:border-emerald-400/70"
                      : isSharkWall
                      ? "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.09] via-slate-900/90 to-[#090D16] hover:border-amber-400/60"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-500/40 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                            isMegaWhale ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <span
                          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                            isMegaWhale ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                      </span>

                      <span className="text-base font-black tracking-tight text-white transition group-hover:text-cyan-300">
                        🐋 {cleanSym}
                      </span>

                      <span className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                        {formatExchange(wall.exchange)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMegaWhale ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                          <Flame className="h-3 w-3 text-emerald-400" /> &gt;$50K WHALE
                        </span>
                      ) : isSharkWall ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                          <Zap className="h-3 w-3 text-amber-400" /> &gt;$10K WALL
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                          Tracked
                        </span>
                      )}

                      <button
                        onClick={(e) => handleBlacklistClick(e, cleanSym)}
                        disabled={isBeingRemoved}
                        title={`Blacklist ${cleanSym}`}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 transition hover:border-rose-500/50 hover:bg-rose-500/25 hover:text-rose-200 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        Bid Wall Size (USD)
                      </span>
                      <p
                        className={`font-mono text-lg font-black ${
                          isMegaWhale
                            ? "text-emerald-400"
                            : isSharkWall
                            ? "text-amber-300"
                            : "text-white"
                        }`}
                      >
                        ${wall.usd_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        Order Book Level
                      </span>
                      <p className="font-mono text-sm font-bold text-cyan-300">
                        @ ${formatCryptoPrice(wall.price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 font-medium text-slate-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        Respect Rate:{" "}
                        <strong className="font-mono text-emerald-300">
                          {respectPct}% respected
                        </strong>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatRelativeTime(seenIso)}
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(10, respectPct))}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          respectPct >= 70
                            ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                            : respectPct >= 45
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