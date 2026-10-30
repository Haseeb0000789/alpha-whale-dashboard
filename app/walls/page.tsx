// app/walls/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import WallTable from "@/components/WallTable";
import DepthChart from "@/components/DepthChart";
import { BidWall } from "@/types/types";
import {
  Shield,
  Flame,
  RefreshCw,
  Search,
  DollarSign,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 7000;

const FALLBACK_WALLS: BidWall[] = [
  {
    symbol: "BULLA",
    exchange: "binance_alpha",
    price: 0.058,
    usd_value: 386129,
    respect_rate: 0.88,
    last_seen: "2026-10-30T11:51:00.000Z",
  },
  {
    symbol: "GRASS",
    exchange: "kucoin",
    price: 0.6952,
    usd_value: 69522,
    respect_rate: 0.92,
    last_seen: "2026-10-30T11:50:30.000Z",
  },
  {
    symbol: "KII",
    exchange: "binance_alpha",
    price: 0.08506595,
    usd_value: 52240,
    respect_rate: 0.78,
    last_seen: "2026-10-30T11:50:00.000Z",
  },
  {
    symbol: "AKE",
    exchange: "binance_alpha",
    price: 0.01954757,
    usd_value: 41093,
    respect_rate: 0.74,
    last_seen: "2026-10-30T11:49:00.000Z",
  },
  {
    symbol: "DOS",
    exchange: "binance_alpha",
    price: 0.299919,
    usd_value: 20702,
    respect_rate: 0.5,
    last_seen: "2026-10-30T11:48:00.000Z",
  },
];

export default function LiveWallsPage() {
  const [walls, setWalls] = useState<BidWall[]>([]);
  const [blacklistedSet, setBlacklistedSet] = useState<Set<string>>(new Set());
  const [searchSymbol, setSearchSymbol] = useState<string>("");
  const [selectedWallSymbol, setSelectedWallSymbol] = useState<string>("BULLA");

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchWalls = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/walls/active`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("API offline");
        const data = await res.json();
        const raw: BidWall[] = Array.isArray(data) ? data : data.walls || [];

        startTransition(() => {
          setWalls(
            raw.filter(
              (w) => !blacklistedSet.has(w.symbol.trim().toUpperCase())
            )
          );
        });
      } catch {
        startTransition(() => {
          setWalls((prev) =>
            prev.length > 0
              ? prev
              : FALLBACK_WALLS.filter(
                  (w) => !blacklistedSet.has(w.symbol.trim().toUpperCase())
                )
          );
        });
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [blacklistedSet]
  );

  useEffect(() => {
    fetchWalls(false);
    const timer = setInterval(() => {
      fetchWalls(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchWalls]);

  const handleBlacklist = useCallback(async (symbol: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    setBlacklistedSet((prev) => new Set(prev).add(cleanSym));
    setWalls((prev) =>
      prev.filter((w) => w.symbol.trim().toUpperCase() !== cleanSym)
    );

    try {
      await fetch(`${API_BASE_URL}/api/dashboard/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: cleanSym }),
      });
    } catch {
      // Optimistic fallback
    } finally {
      setToastMessage(`Token Blacklisted: ${cleanSym}`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  }, []);

  const filteredWalls = useMemo(() => {
    return walls.filter((w) => {
      const sym = w.symbol.trim().toUpperCase();
      if (blacklistedSet.has(sym)) return false;
      if (
        searchSymbol.trim() &&
        !sym.toLowerCase().includes(searchSymbol.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [walls, blacklistedSet, searchSymbol]);

  const totalBidLiquidityUsd = useMemo(
    () => filteredWalls.reduce((acc, w) => acc + (w.usd_value || 0), 0),
    [filteredWalls]
  );

  const megaWhaleCount = useMemo(
    () => filteredWalls.filter((w) => w.usd_value > 50000).length,
    [filteredWalls]
  );

  const focusedWall = useMemo(() => {
    return (
      filteredWalls.find(
        (w) => w.symbol.trim().toUpperCase() === selectedWallSymbol
      ) ||
      filteredWalls[0] || {
        symbol: "BULLA",
        price: 0.058,
        usd_value: 386129,
      }
    );
  }, [filteredWalls, selectedWallSymbol]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 pb-24">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Tracked Bid Depth
            </span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-400 sm:text-3xl">
            ${totalBidLiquidityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <span className="mt-1 block text-[11px] text-slate-400">
            Combined across Binance Alpha, KuCoin, Bitget & MEXC
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mega Whale Walls (&gt;$50K)
            </span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-white sm:text-3xl">
            {megaWhaleCount}
          </p>
          <span className="mt-1 block text-[11px] text-slate-400">
            High-dominance institutional price floors
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filter & Sync
            </span>
            <Shield className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                placeholder="Filter wall token..."
                className="w-full rounded-xl border border-slate-700/60 bg-[#07090E] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <button
              onClick={() => fetchWalls(true)}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-200 transition hover:border-emerald-500/40 hover:text-emerald-300"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isRefreshing || isPending ? "animate-spin text-emerald-400" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Wall Cards + Interactive Depth Visualizer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 min-h-[540px]">
        <div className="lg:col-span-7">
          <WallTable
            walls={filteredWalls}
            isLoading={isInitialLoading}
            onSelectSymbol={(sym) => setSelectedWallSymbol(sym)}
            onBlacklist={handleBlacklist}
          />
        </div>

        <div className="space-y-5 lg:col-span-5">
          <DepthChart
            symbol={focusedWall.symbol}
            midPrice={focusedWall.price * 1.008}
            wallPrice={focusedWall.price}
            wallUsd={focusedWall.usd_value}
            height={300}
          />

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>How to Trade Bid Wall Setups</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              Click any wall card on the left to inspect its cumulative Bid vs. Ask imbalance curve above. Look for tokens with{" "}
              <strong className="text-emerald-300">&gt;70% Respect Rate</strong> and{" "}
              <strong className="text-cyan-300">&gt;1.8x Bid/Ask Ratio</strong> (Ask Vacuum) for low-risk spot scalps.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Floating Refresh Button */}
      <button
        onClick={() => fetchWalls(true)}
        aria-label="Refresh Walls"
        className="fixed bottom-6 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.5)] transition active:scale-90 md:hidden"
      >
        <RefreshCw
          className={`h-5 w-5 ${isRefreshing || isPending ? "animate-spin" : ""}`}
        />
      </button>

      {/* Blacklist Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="wall-toast"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-rose-500/40 bg-[#0B0F19]/95 px-4 py-3 text-xs font-bold text-rose-300 shadow-2xl backdrop-blur-xl"
          >
            <Ban className="h-4 w-4 text-rose-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}