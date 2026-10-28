// components/WallTable.tsx
"use client";

import React, { useState, useMemo } from "react";
import { BidWall, formatCryptoPrice, formatRelativeTime } from "@/types/types";
import { Shield, ArrowUpDown, Flame, Layers } from "lucide-react";

interface WallTableProps {
  walls: BidWall[];
  isLoading: boolean;
  onSelectSymbol?: (symbol: string) => void;
}

type SortKey = "usd_value" | "last_seen" | "symbol";

export default function WallTable({ walls, isLoading, onSelectSymbol }: WallTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("usd_value");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Deduplicate identical (symbol, exchange, price) walls and sort
  const sortedWalls = useMemo(() => {
    const map = new Map<string, BidWall>();
    for (const w of walls) {
      const k = `${w.symbol.trim().toUpperCase()}-${w.exchange}-${Number(w.price).toPrecision(6)}`;
      const existing = map.get(k);
      if (!existing || w.usd_value > existing.usd_value) {
        map.set(k, w);
      }
    }

    const list = Array.from(map.values());
    return list.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "usd_value") {
        comparison = a.usd_value - b.usd_value;
      } else if (sortKey === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      } else {
        const timeA = new Date(a.last_seen || a.last_seen_at || 0).getTime();
        const timeB = new Date(b.last_seen || b.last_seen_at || 0).getTime();
        comparison = timeA - timeB;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [walls, sortKey, sortAsc]);

  // Identify the top 3 most recently updated timestamps for the flashing green dot
  const recentCutoffMs = useMemo(() => {
    if (sortedWalls.length === 0) return 0;
    const timestamps = sortedWalls
      .map((w) => new Date(w.last_seen || w.last_seen_at || 0).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => b - a);
    return timestamps[Math.min(3, timestamps.length - 1)] || Date.now() - 120000;
  }, [sortedWalls]);

  const formatExchangeBadge = (ex: string) => {
    const clean = (ex || "binance_alpha").replace("_", " ").toUpperCase();
    return clean;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-[#0B0F17]/90 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              Live Bid Walls Radar
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                {sortedWalls.length} Active
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Rows highlighted in neon emerald exceed $50,000 institutional depth
            </p>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="max-h-[540px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0B0F17]/95 backdrop-blur-md text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
            <tr>
              <th className="py-3 pl-5 pr-2">
                <button
                  onClick={() => handleSort("symbol")}
                  className="flex items-center gap-1 hover:text-white transition"
                >
                  Token <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-2 py-3">Exchange</th>
              <th className="px-2 py-3">Wall Price</th>
              <th className="px-2 py-3">
                <button
                  onClick={() => handleSort("usd_value")}
                  className="flex items-center gap-1 hover:text-white transition"
                >
                  Depth (USD) <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-3 pl-2 pr-5 text-right">
                <button
                  onClick={() => handleSort("last_seen")}
                  className="ml-auto flex items-center justify-end gap-1 hover:text-white transition"
                >
                  Seen <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-xs">
            {isLoading && sortedWalls.length === 0 ? (
              [...Array(6)].map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={5} className="px-5 py-4">
                    <div className="h-5 rounded bg-slate-800/60" />
                  </td>
                </tr>
              ))
            ) : sortedWalls.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                  <Layers className="mx-auto mb-2 h-7 w-7 opacity-40" />
                  No active bid walls detected right now.
                </td>
              </tr>
            ) : (
              sortedWalls.map((wall, idx) => {
                const isWhale = wall.usd_value > 50000;
                const seenIso = wall.last_seen || wall.last_seen_at;
                const seenMs = seenIso ? new Date(seenIso).getTime() : 0;
                const isMostRecent = seenMs >= recentCutoffMs || Date.now() - seenMs < 90000;

                return (
                  <tr
                    key={`${wall.symbol}-${wall.exchange}-${wall.price}-${idx}`}
                    onClick={() => onSelectSymbol && onSelectSymbol(wall.symbol.trim())}
                    className={`group cursor-pointer transition-colors ${
                      isWhale
                        ? "bg-emerald-500/[0.09] hover:bg-emerald-500/[0.16]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Token + Flashing Live Dot */}
                    <td className="py-3.5 pl-5 pr-2 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        {isMostRecent ? (
                          <span className="relative flex h-2.5 w-2.5" title="Freshly updated wall">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80"></span>
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                          </span>
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-600" />
                        )}
                        <span className="group-hover:text-cyan-300 transition">
                          {wall.symbol.trim()}
                        </span>
                      </div>
                    </td>

                    {/* Exchange */}
                    <td className="px-2 py-3.5">
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {formatExchangeBadge(wall.exchange)}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-2 py-3.5 font-mono text-slate-200">
                      ${formatCryptoPrice(wall.price)}
                    </td>

                    {/* USD Value */}
                    <td className="px-2 py-3.5 font-mono font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className={isWhale ? "text-emerald-400" : "text-slate-200"}>
                          ${wall.usd_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                        {isWhale && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                            <Flame className="h-2.5 w-2.5" /> WHALE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Seen */}
                    <td className="py-3.5 pl-2 pr-5 text-right text-[11px] text-slate-400">
                      {formatRelativeTime(seenIso)}
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