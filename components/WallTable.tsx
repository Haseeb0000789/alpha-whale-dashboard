// components/WallTable.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BidWall,
  formatCryptoPrice,
  formatRelativeTime,
  getSyncedNowMs,
} from "@/types/types";
import { WallCardsSkeleton } from "./Skeletons";
import {
  ArrowUpDown,
  Layers,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";

interface WallTableProps {
  walls: BidWall[];
  isLoading: boolean;
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  onBlacklist?: (symbol: string) => Promise<void>;
}

type SortKey = "relevance" | "usd_value" | "proximity" | "respect_rate";

function normalizeRespectPct(raw?: number): number {
  if (raw === undefined || raw === null) return 75;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function formatSafeRelativeTime(isoDate: string | undefined, nowMs: number): string {
  if (!isoDate || nowMs <= 0) return "Live";
  return formatRelativeTime(isoDate, nowMs);
}

export default function WallTable({
  walls,
  isLoading,
  selectedSymbol,
  onSelectSymbol,
}: WallTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    const initId = setTimeout(() => setNowMs(getSyncedNowMs()), 0);
    const id = setInterval(() => setNowMs(getSyncedNowMs()), 30000);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, [walls.length]);

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
      const symA = a.symbol.trim().toUpperCase();
      const symB = b.symbol.trim().toUpperCase();

      if (sortKey === "relevance") {
        const relA = Math.round((a.relevance_score ?? a.entry_score ?? 50) / 2) * 2;
        const relB = Math.round((b.relevance_score ?? b.entry_score ?? 50) / 2) * 2;
        if (relB !== relA) return relB - relA;
        const distDiff =
          Math.round(((a.distance_pct ?? 1) - (b.distance_pct ?? 1)) * 10) / 10;
        if (distDiff !== 0) return distDiff;
        return symA.localeCompare(symB);
      }

      if (sortKey === "proximity") {
        const diff = (a.distance_pct ?? 99) - (b.distance_pct ?? 99);
        if (Math.abs(diff) > 0.02) return diff;
        return symA.localeCompare(symB);
      }

      if (sortKey === "usd_value") {
        if (b.usd_value !== a.usd_value) return b.usd_value - a.usd_value;
        return symA.localeCompare(symB);
      }

      const respDiff =
        normalizeRespectPct(b.respect_rate) -
        normalizeRespectPct(a.respect_rate);
      if (respDiff !== 0) return respDiff;
      if (b.usd_value !== a.usd_value) return b.usd_value - a.usd_value;
      return symA.localeCompare(symB);
    });
  }, [walls, sortKey]);

  const formatExchange = (ex: string) =>
    (ex || "binance_alpha").replace("_", " ").toUpperCase();

  return (
    <div className="space-y-2.5">
      {/* Slim Sort Sub-Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-400">
          Click any wall card to inspect its live L2 order book depth
        </span>

        <div className="inline-flex items-center gap-0.5 rounded-md border border-[#2B3139] bg-[#161A1E] p-0.5 text-[11px]">
          <ArrowUpDown className="ml-1.5 mr-1 h-3 w-3 text-slate-500" />
          {(
            [
              ["relevance", "Relevant"],
              ["proximity", "Closest %"],
              ["usd_value", "Size ($)"],
              ["respect_rate", "Respect %"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                sortKey === key
                  ? "bg-[#2B3139] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Grid Layout for Walls */}
      {isLoading && sortedWalls.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <WallCardsSkeleton count={6} />
        </div>
      ) : sortedWalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-[#2B3139] bg-[#1E2329] py-14 text-center text-xs text-slate-400">
          <Layers className="mb-2 h-6 w-6 opacity-40" />
          <span>No active bid walls matching current filters.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {sortedWalls.map((wall) => {
              const cleanSym = wall.symbol.trim().toUpperCase();
              const respectPct = normalizeRespectPct(wall.respect_rate);
              const distPct = wall.distance_pct ?? 0.45;
              const midPrice = wall.mid_price || wall.price * (1 + distPct / 100);
              const seenIso = wall.last_seen || wall.last_seen_at;
              const isSelected =
                selectedSymbol &&
                selectedSymbol.trim().toUpperCase() === cleanSym;

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

              return (
                <motion.div
                  key={cleanSym}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  onClick={() => onSelectSymbol && onSelectSymbol(cleanSym)}
                  className={`group flex cursor-pointer flex-col justify-between rounded-lg border p-3.5 transition-colors ${
                    isSelected
                      ? "border-emerald-500/60 bg-[#1E2329]"
                      : "border-[#2B3139] bg-[#1E2329] hover:border-slate-600"
                  }`}
                >
                  {/* Header: Bold Symbol + Mid Price & Bold USD Value + Distance */}
                  <div className="flex items-start justify-between gap-2 border-b border-[#2B3139] pb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                        <Link
                          href={`/coin/${encodeURIComponent(cleanSym)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-sm font-extrabold tracking-tight text-white transition hover:text-slate-200"
                        >
                          <span>{cleanSym}/USDT</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                        </Link>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-xs">
                        <span className="text-slate-400">Mid:</span>
                        <span className="font-bold text-white">
                          ${formatCryptoPrice(midPrice)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-sm font-extrabold text-emerald-400">
                        ${wall.usd_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                      <span className="inline-block rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                        -{distPct.toFixed(2)}% away
                      </span>
                    </div>
                  </div>

                  {/* Per-Exchange Breakdown */}
                  <div className="my-2.5 space-y-1 font-mono text-xs">
                    {exWalls.slice(0, 3).map((ew, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded bg-[#161A1E] px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-sans text-[11px] font-bold text-slate-300">
                            {formatExchange(ew.exchange)}
                          </span>
                          <span className="font-bold text-emerald-400">
                            ${ew.usd_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-bold text-white">
                            @${formatCryptoPrice(ew.price)}
                          </span>{" "}
                          <span className="text-[11px] text-slate-400">
                            (-{(ew.distance_pct ?? distPct).toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: Respect Rate & L2 Depth Inspect Action */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">
                        Respect:{" "}
                        <strong className="font-mono font-bold text-slate-200">
                          {respectPct}%
                        </strong>
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500">
                        {formatSafeRelativeTime(seenIso, nowMs)}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300 group-hover:border-white/20 group-hover:text-white">
                      <BarChart3 className="h-3 w-3 text-emerald-400" />
                      <span>Depth</span>
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
