// app/walls/page.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WallTable from "@/components/WallTable";
import DepthChart from "@/components/DepthChart";
import {
  useDashboardSocket,
  resolveApiBase,
} from "@/context/DashboardSocketContext";
import { DepthPoint } from "@/types/types";
import {
  RefreshCw,
  Search,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

export default function LiveWallsPage() {
  const { walls, settings, isInitialLoading, triggerRefresh } =
    useDashboardSocket();
  const [searchSymbol, setSearchSymbol] = useState<string>("");
  const [selectedWallSymbol, setSelectedWallSymbol] = useState<string>("");
  const [showDepthDrawer, setShowDepthDrawer] = useState<boolean>(false);
  const [fetchedDepthState, setFetchedDepthState] = useState<{
    symbol: string;
    depth?: DepthPoint[];
    bidAskRatio?: number | null;
  } | null>(null);

  const minWallUsd = settings?.min_wall_usd ?? 5000;
  const maxProximityPct = settings?.proximity_pct ?? 1.5;

  const filteredWalls = useMemo(() => {
    const minSubWallUsd = Math.min(minWallUsd, 1500);

    return walls
      .map((w) => {
        const canonicalMid =
          w.mid_price && w.mid_price > w.price
            ? w.mid_price
            : w.price * (1 + (w.distance_pct ?? 0.4) / 100);

        if (w.exchange_walls && w.exchange_walls.length > 0) {
          const validExWalls = w.exchange_walls
            .map((ew) => {
              const trueDist =
                canonicalMid > ew.price
                  ? Number(
                      (((canonicalMid - ew.price) / canonicalMid) * 100).toFixed(2)
                    )
                  : -1;
              return {
                ...ew,
                distance_pct: trueDist,
              };
            })
            .filter(
              (ew) =>
                ew.usd_value >= minSubWallUsd &&
                ew.price < canonicalMid &&
                ew.distance_pct >= 0.01 &&
                ew.distance_pct <= maxProximityPct
            );

          if (validExWalls.length === 0) return null;
          validExWalls.sort((a, b) => a.distance_pct - b.distance_pct);

          const newTotal = validExWalls.reduce(
            (sum, ew) => sum + ew.usd_value,
            0
          );
          if (newTotal < minWallUsd) return null;

          return {
            ...w,
            mid_price: canonicalMid,
            price: validExWalls[0].price,
            exchange: validExWalls[0].exchange,
            distance_pct: validExWalls[0].distance_pct,
            usd_value: newTotal,
            exchange_walls: validExWalls,
          };
        }

        const singleDist =
          canonicalMid > w.price
            ? Number((((canonicalMid - w.price) / canonicalMid) * 100).toFixed(2))
            : -1;

        if (
          w.usd_value < minWallUsd ||
          singleDist < 0.01 ||
          singleDist > maxProximityPct
        ) {
          return null;
        }

        return {
          ...w,
          mid_price: canonicalMid,
          distance_pct: singleDist,
        };
      })
      .filter((w): w is NonNullable<typeof w> => {
        if (!w) return false;
        const sym = w.symbol.trim().toUpperCase();
        if (
          searchSymbol.trim() &&
          !sym.toLowerCase().includes(searchSymbol.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      });
  }, [walls, minWallUsd, maxProximityPct, searchSymbol]);

  const focusedWall = useMemo(() => {
    if (selectedWallSymbol) {
      const found = filteredWalls.find(
        (w) => w.symbol.trim().toUpperCase() === selectedWallSymbol
      );
      if (found) return found;
    }
    return filteredWalls[0] ?? null;
  }, [filteredWalls, selectedWallSymbol]);

  const focusedSym = focusedWall?.symbol?.trim().toUpperCase() || "";
  const liveDepth =
    fetchedDepthState && fetchedDepthState.symbol === focusedSym
      ? fetchedDepthState.depth
      : undefined;
  const liveBidAskRatio =
    fetchedDepthState && fetchedDepthState.symbol === focusedSym
      ? fetchedDepthState.bidAskRatio
      : undefined;

  useEffect(() => {
    if (!focusedSym || !showDepthDrawer) return;

    let active = true;

    const pullDepth = () => {
      const apiBase = resolveApiBase();
      fetch(`${apiBase}/api/depth/${encodeURIComponent(focusedSym)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active || !data) return;
          setFetchedDepthState({
            symbol: focusedSym,
            depth:
              Array.isArray(data.depth) && data.depth.length > 0
                ? data.depth
                : undefined,
            bidAskRatio:
              typeof data.bid_ask_ratio === "number"
                ? data.bid_ask_ratio
                : undefined,
          });
        })
        .catch(() => {});
    };

    pullDepth();
    const timer = setInterval(pullDepth, 12000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [focusedSym, showDepthDrawer]);

  const handleSelectWallSymbol = (sym: string) => {
    setSelectedWallSymbol(sym);
    setShowDepthDrawer(true);
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-3 sm:px-6 pb-20">
      {/* Ultra-Slim Top Header: Total Count, Collapsible Depth Toggle, Small Search Input & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[#2B3139] bg-[#161A1E] px-3.5 py-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
            Live Bid Walls
          </h1>
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
            {filteredWalls.length} Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDepthDrawer((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
              showDepthDrawer
                ? "border-emerald-500/40 bg-[#2B3139] text-white"
                : "border-[#2B3139] bg-[#1E2329] text-slate-300 hover:border-slate-600 hover:text-white"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              L2 Depth {focusedSym ? `(${focusedSym})` : ""}
            </span>
            {showDepthDrawer ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              placeholder="Search token..."
              className="w-36 rounded-md border border-[#2B3139] bg-[#0B0E11] py-1 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none sm:w-44"
            />
          </div>

          <button
            onClick={triggerRefresh}
            title="Refresh Live Walls"
            className="inline-flex items-center justify-center rounded-md border border-[#2B3139] bg-[#1E2329] p-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible Top L2 Depth Chart Drawer (Never squeezes the full-width walls grid) */}
      <AnimatePresence initial={false}>
        {showDepthDrawer && focusedWall && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="relative rounded-lg border border-[#2B3139] bg-[#161A1E] p-3">
              <button
                onClick={() => setShowDepthDrawer(false)}
                title="Close Depth Chart"
                className="absolute right-3 top-3 z-10 rounded-md border border-[#2B3139] bg-[#1E2329] p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <DepthChart
                symbol={focusedWall.symbol}
                midPrice={focusedWall.mid_price || focusedWall.price * 1.005}
                wallPrice={focusedWall.price}
                wallUsd={focusedWall.usd_value}
                depthData={liveDepth}
                bidAskRatio={liveBidAskRatio}
                height={260}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Focus: Full-Width 3-Column Grid of Walls */}
      <WallTable
        walls={filteredWalls}
        isLoading={isInitialLoading}
        selectedSymbol={focusedSym}
        onSelectSymbol={handleSelectWallSymbol}
      />
    </main>
  );
}
