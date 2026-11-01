// app/walls/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import WallTable from "@/components/WallTable";
import DepthChart from "@/components/DepthChart";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import {
  Shield,
  Flame,
  RefreshCw,
  Search,
  DollarSign,
  CheckCircle2,
} from "lucide-react";

export default function LiveWallsPage() {
  const { walls, isInitialLoading, triggerRefresh } = useDashboardSocket();
  const [searchSymbol, setSearchSymbol] = useState<string>("");
  const [selectedWallSymbol, setSelectedWallSymbol] = useState<string>("");

  const filteredWalls = useMemo(() => {
    return walls.filter((w) => {
      const sym = w.symbol.trim().toUpperCase();
      if (
        searchSymbol.trim() &&
        !sym.toLowerCase().includes(searchSymbol.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [walls, searchSymbol]);

  const totalBidLiquidityUsd = useMemo(
    () => filteredWalls.reduce((acc, w) => acc + (w.usd_value || 0), 0),
    [filteredWalls]
  );

  const megaWhaleCount = useMemo(
    () => filteredWalls.filter((w) => w.usd_value > 50000).length,
    [filteredWalls]
  );

  const focusedWall = useMemo(() => {
    if (selectedWallSymbol) {
      const found = filteredWalls.find(
        (w) => w.symbol.trim().toUpperCase() === selectedWallSymbol
      );
      if (found) return found;
    }
    return (
      filteredWalls[0] || {
        symbol: "CT",
        price: 0.14015,
        mid_price: 0.14021,
        usd_value: 41547,
      }
    );
  }, [filteredWalls, selectedWallSymbol]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-3 sm:px-6 pb-16">
      {/* Sleek 3-Card Top Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-gradient-to-r from-slate-900/90 via-[#0B0F19] to-[#080B12] px-4 py-2.5 shadow-md">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent opacity-80" />
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Tracked Bid Depth
              </span>
              <span className="text-[10px] text-slate-500">
                Alpha • KuCoin • Bitget • MEXC • OKX
              </span>
            </div>
          </div>
          <p className="font-mono text-lg font-black text-emerald-400 sm:text-xl">
            ${totalBidLiquidityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-gradient-to-r from-slate-900/90 via-[#0B0F19] to-[#080B12] px-4 py-2.5 shadow-md">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent opacity-80" />
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Mega Whale Walls (&gt;$50K)
              </span>
              <span className="text-[10px] text-slate-500">
                Institutional price floors
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="font-mono text-xl font-black text-white sm:text-2xl">
              {megaWhaleCount}
            </p>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              Active
            </span>
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-slate-800/90 bg-gradient-to-r from-slate-900/90 via-[#0B0F19] to-[#080B12] px-4 py-2.5 shadow-md">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent opacity-80" />
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Shield className="h-4 w-4" />
            </div>
            <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:block">
              Filter
            </span>
          </div>

          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                placeholder="Search wall token..."
                className="w-full rounded-lg border border-slate-700/60 bg-[#07090E] py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <button
              onClick={triggerRefresh}
              title="Instant WebSocket Sync"
              className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-slate-200 transition hover:border-emerald-500/40 hover:text-emerald-300"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <WallTable
            walls={filteredWalls}
            isLoading={isInitialLoading}
            onSelectSymbol={(sym) => setSelectedWallSymbol(sym)}
          />
        </div>

        <div className="space-y-3 lg:sticky lg:top-20 lg:col-span-5">
          <DepthChart
            symbol={focusedWall.symbol}
            midPrice={focusedWall.mid_price || focusedWall.price * 1.005}
            wallPrice={focusedWall.price}
            wallUsd={focusedWall.usd_value}
            height={320}
          />

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-4 py-3 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-bold text-white">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>How to Trade Bid Wall Setups</span>
            </div>
            <p className="mt-1 leading-relaxed text-slate-400">
              Click any wall card on the left to inspect its cumulative Bid vs. Ask imbalance curve above. Look for tokens with{" "}
              <strong className="text-emerald-300">&gt;70% Respect Rate</strong> and{" "}
              <strong className="text-cyan-300">&gt;1.8x Bid/Ask Ratio</strong> (Ask Vacuum) for low-risk spot scalps.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}