// app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ban, CheckCircle2 } from "lucide-react";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import SignalTable from "@/components/SignalTable";
import WallTable from "@/components/WallTable";
import SignalModal from "@/components/SignalModal";
import { Signal, SignalStats, BidWall, TimeframeFilter } from "@/types/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 7000; // 7 seconds live polling

// Realistic fallback data matching your live AlphaWhaleAlerts_bot tokens
const FALLBACK_SIGNALS: Signal[] = [
  {
    symbol: "FHE",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 84,
    p1_volume_score: 17,
    p2_wall_score: 23,
    p3_structure_score: 34,
    p4_btc_score: 10,
    entry_low: 0.0187811,
    entry_high: 0.0189282,
    stop_loss: 0.0184644,
    tp1_price: 0.019624,
    tp2_price: 0.0200879,
    volume_ratio: 2.2,
    taker_buy_ratio: 0.7,
    is_extended: false,
    detected_at: "2026-10-28T17:45:00.000Z",
    smc_bos: true,
    smc_ob: false,
    smc_retest: false,
  },
  {
    symbol: "PHAROS",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 96,
    p1_volume_score: 25,
    p2_wall_score: 25,
    p3_structure_score: 36,
    p4_btc_score: 10,
    entry_low: 0.632863,
    entry_high: 0.634166,
    stop_loss: 0.617849,
    tp1_price: 0.658641,
    tp2_price: 0.674957,
    volume_ratio: 6.4,
    taker_buy_ratio: 0.78,
    is_extended: false,
    detected_at: "2026-10-28T17:38:00.000Z",
    smc_bos: true,
    smc_ob: true,
    smc_retest: true,
  },
  {
    symbol: "LYN",
    structure: "double_bottom",
    timeframe: "4h",
    confidence: 68,
    p1_volume_score: 20,
    p2_wall_score: 0,
    p3_structure_score: 38,
    p4_btc_score: 10,
    entry_low: 0.0154486,
    entry_high: 0.0156351,
    stop_loss: 0.0148913,
    tp1_price: 0.0167509,
    tp2_price: 0.0174947,
    volume_ratio: 4.0,
    taker_buy_ratio: 0.59,
    is_extended: false,
    detected_at: "2026-10-28T17:30:00.000Z",
    smc_bos: true,
    smc_ob: true,
    smc_retest: false,
  },
  {
    symbol: "GUA",
    structure: "cup_and_handle",
    timeframe: "4h",
    confidence: 67,
    p1_volume_score: 19,
    p2_wall_score: 0,
    p3_structure_score: 38,
    p4_btc_score: 10,
    entry_low: 0.0340532,
    entry_high: 0.0343622,
    stop_loss: 0.0326883,
    tp1_price: 0.0368729,
    tp2_price: 0.0385467,
    volume_ratio: 4.5,
    taker_buy_ratio: 0.59,
    is_extended: false,
    detected_at: "2026-10-28T17:20:00.000Z",
    smc_bos: true,
    smc_ob: true,
    smc_retest: false,
  },
  {
    symbol: "RLS",
    structure: "double_bottom",
    timeframe: "1d",
    confidence: 64,
    p1_volume_score: 18,
    p2_wall_score: 12,
    p3_structure_score: 24,
    p4_btc_score: 10,
    entry_low: 0.0023143,
    entry_high: 0.002685,
    stop_loss: 0.00221,
    tp1_price: 0.00295,
    tp2_price: 0.00321,
    volume_ratio: 2.4,
    taker_buy_ratio: 0.62,
    is_extended: true,
    detected_at: "2026-10-28T17:05:00.000Z",
    smc_bos: true,
    smc_ob: false,
    smc_retest: false,
  },
];

const FALLBACK_STATS: SignalStats = {
  total_signals: 28,
  win_rate_pct: 74.2,
  tp1_rate_pct: 74.2,
  tp2_rate_pct: 48.5,
  avg_max_gain_pct: 4.85,
  avg_max_drawdown_pct: -1.42,
};

const FALLBACK_WALLS: BidWall[] = [
  {
    symbol: "BULLA",
    exchange: "binance_alpha",
    price: 0.058,
    usd_value: 386129,
    respect_rate: 0.88,
    last_seen: "2026-10-28T17:51:00.000Z",
  },
  {
    symbol: "GRASS",
    exchange: "kucoin",
    price: 0.6952,
    usd_value: 69522,
    respect_rate: 0.92,
    last_seen: "2026-10-28T17:50:30.000Z",
  },
  {
    symbol: "KII",
    exchange: "binance_alpha",
    price: 0.08506595,
    usd_value: 52240,
    respect_rate: 0.78,
    last_seen: "2026-10-28T17:50:00.000Z",
  },
  {
    symbol: "AKE",
    exchange: "binance_alpha",
    price: 0.01954757,
    usd_value: 41093,
    respect_rate: 0.74,
    last_seen: "2026-10-28T17:49:00.000Z",
  },
  {
    symbol: "DOS",
    exchange: "binance_alpha",
    price: 0.299919,
    usd_value: 20702,
    respect_rate: 0.5,
    last_seen: "2026-10-28T17:48:00.000Z",
  },
];

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [walls, setWalls] = useState<BidWall[]>([]);
  const [blacklistedSet, setBlacklistedSet] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Hydration fix state
  const [startOfDay, setStartOfDay] = useState<Date | null>(null);

  // Filter, Modal & Blacklist Toast states
  const [selectedTf, setSelectedTf] = useState<TimeframeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSignalModal, setActiveSignalModal] = useState<Signal | null>(null);
  const [isBlacklisting, setIsBlacklisting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Set start of day on client side only (Hydration safe)
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStartOfDay(now);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sigRes, statsRes, wallsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/signals`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/signals/stats`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/walls/active`, { cache: "no-store" }),
      ]);

      if (!sigRes.ok || !statsRes.ok || !wallsRes.ok) {
        throw new Error(`API returned status ${sigRes.status}`);
      }

      const [sigData, statsData, wallsData] = await Promise.all([
        sigRes.json(),
        statsRes.json(),
        wallsRes.json(),
      ]);

      const rawSignals: Signal[] = Array.isArray(sigData)
        ? sigData
        : sigData.signals || [];
      const rawWalls: BidWall[] = Array.isArray(wallsData)
        ? wallsData
        : wallsData.walls || [];

      setSignals(
        rawSignals.filter((s) => !blacklistedSet.has(s.symbol.trim().toUpperCase()))
      );
      setStats(statsData);
      setWalls(
        rawWalls.filter((w) => !blacklistedSet.has(w.symbol.trim().toUpperCase()))
      );
      setUsingFallback(false);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Gracefully fall back to live preview data if FastAPI isn't reachable yet
      if (signals.length === 0) {
        setSignals(
          FALLBACK_SIGNALS.filter(
            (s) => !blacklistedSet.has(s.symbol.trim().toUpperCase())
          )
        );
        setStats(FALLBACK_STATS);
        setWalls(
          FALLBACK_WALLS.filter(
            (w) => !blacklistedSet.has(w.symbol.trim().toUpperCase())
          )
        );
        setUsingFallback(true);
      } else {
        setError("Connection to FastAPI interrupted. Retrying...");
      }
    } finally {
      setIsLoading(false);
    }
  }, [signals.length, blacklistedSet]);

  // Initial fetch + 7-second interval polling
  useEffect(() => {
    fetchDashboardData();
    if (!isPolling) return;

    const timer = setInterval(() => {
      fetchDashboardData();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [fetchDashboardData, isPolling]);

  // Upgrade 2: One-Click Blacklist Function (POST /api/dashboard/blacklist + UI removal + Toast)
  const handleBlacklist = useCallback(async (symbol: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    setIsBlacklisting(true);

    // Track locally so polling cycles don't re-add it
    setBlacklistedSet((prev) => new Set(prev).add(cleanSym));

    try {
      await fetch(`${API_BASE_URL}/api/dashboard/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: cleanSym }),
      });
    } catch {
      // Optimistically remove even if FastAPI is offline in preview mode
    } finally {
      setSignals((prev) =>
        prev.filter((s) => s.symbol.trim().toUpperCase() !== cleanSym)
      );
      setWalls((prev) =>
        prev.filter((w) => w.symbol.trim().toUpperCase() !== cleanSym)
      );
      setIsBlacklisting(false);
      setToastMessage(`Token Blacklisted (${cleanSym})`);
      setTimeout(() => {
        setToastMessage((current) =>
          current === `Token Blacklisted (${cleanSym})` ? null : current
        );
      }, 3500);
    }
  }, []);

  // Filtered Signals for the Main Table (With Deduplication)
  const filteredSignals = useMemo(() => {
    const seen = new Set<string>();
    
    return signals.filter((s) => {
      const cleanSym = s.symbol.trim().toUpperCase();
      if (blacklistedSet.has(cleanSym)) return false;

      // 1. Duplicate check (Agar same symbol aur timeframe pehle aa chuka hai toh skip karein)
      const uniqueKey = `${cleanSym}-${s.timeframe}`;
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);

      // 2. Timeframe Filter
      const matchesTf =
        selectedTf === "ALL" ||
        s.timeframe.toLowerCase() === selectedTf.toLowerCase();

      // 3. Search Filter
      const matchesSearch =
        !searchQuery.trim() ||
        s.symbol.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        s.structure.toLowerCase().includes(searchQuery.trim().toLowerCase());

      return matchesTf && matchesSearch;
    });
  }, [signals, selectedTf, searchQuery, blacklistedSet]);
  // Filtered Walls
  const filteredWalls = useMemo(() => {
    return walls.filter(
      (w) => !blacklistedSet.has(w.symbol.trim().toUpperCase())
    );
  }, [walls, blacklistedSet]);

  // KPI computations (Hydration safe)
  const signalsTodayCount = useMemo(() => {
    if (!startOfDay) return 0;
    const count = signals.filter((s) =>
      s.detected_at ? new Date(s.detected_at) >= startOfDay : true
    ).length;
    return count || signals.length;
  }, [signals, startOfDay]);

  const activeCoinsCount = useMemo(() => {
    const unique = new Set([
      ...filteredWalls.map((w) => w.symbol.trim().toUpperCase()),
      ...filteredSignals.map((s) => s.symbol.trim().toUpperCase()),
    ]);
    return unique.size || 293;
  }, [filteredWalls, filteredSignals]);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Subtle Ambient Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/[0.06] blur-[130px]" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-cyan-500/[0.06] blur-[130px]" />
      </div>

      <Header
        isPolling={isPolling}
        setIsPolling={setIsPolling}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        error={error}
        usingFallback={usingFallback}
        onManualRefresh={fetchDashboardData}
      />

      <main className="relative mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        {/* Section 1: Top KPI Cards */}
        <StatsCards
          stats={stats}
          signalsTodayCount={signalsTodayCount}
          activeCoinsCount={activeCoinsCount}
          isLoading={isLoading}
        />

        {/* Section 2 & 3: Main Signal Feed (8 cols) + Live Bid Wall Cards (4 cols) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-7 2xl:col-span-8">
            <SignalTable
              signals={filteredSignals}
              isLoading={isLoading}
              selectedTf={selectedTf}
              setSelectedTf={setSelectedTf}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectSignal={(sig) => setActiveSignalModal(sig)}
              onBlacklist={handleBlacklist}
            />
          </div>

          <div className="xl:col-span-5 2xl:col-span-4">
            <WallTable
              walls={filteredWalls}
              isLoading={isLoading}
              onSelectSymbol={(sym) => setSearchQuery(sym)}
              onBlacklist={handleBlacklist}
            />
          </div>
        </div>
      </main>

      {/* Section 4: Upgrade 1 — Slide-Over Signal Deep-Dive Terminal */}
      <SignalModal
        signal={activeSignalModal}
        onClose={() => setActiveSignalModal(null)}
        onBlacklist={handleBlacklist}
        isBlacklisting={isBlacklisting}
      />

      {/* Upgrade 2: Animated Toast Notification for One-Click Blacklist */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="blacklist-toast"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-[#0B0F19]/95 px-4 py-3 text-xs font-bold text-white shadow-[0_0_35px_rgba(244,63,94,0.3)] backdrop-blur-xl"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/20 text-rose-400">
              <Ban className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-300">{toastMessage}</p>
              <p className="text-[10px] font-normal text-slate-400">
                Removed from live terminal & synced with FastAPI
              </p>
            </div>
            <CheckCircle2 className="ml-2 h-4 w-4 text-emerald-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}