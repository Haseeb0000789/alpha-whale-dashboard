// app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
    is_extended: false,
    detected_at: new Date(Date.now() - 4 * 60000).toISOString(),
    smc_bos: true,
    smc_ob: false,
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
    is_extended: false,
    detected_at: new Date(Date.now() - 11 * 60000).toISOString(),
    smc_bos: true,
    smc_ob: true,
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
    is_extended: false,
    detected_at: new Date(Date.now() - 18 * 60000).toISOString(),
    smc_bos: true,
    smc_ob: true,
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
    is_extended: false,
    detected_at: new Date(Date.now() - 25 * 60000).toISOString(),
    smc_bos: true,
    smc_ob: true,
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
    is_extended: true,
    detected_at: new Date(Date.now() - 42 * 60000).toISOString(),
    smc_bos: true,
    smc_ob: false,
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
    last_seen: new Date(Date.now() - 12000).toISOString(),
  },
  {
    symbol: "GRASS",
    exchange: "kucoin",
    price: 0.6952,
    usd_value: 69522,
    last_seen: new Date(Date.now() - 25000).toISOString(),
  },
  {
    symbol: "KII",
    exchange: "binance_alpha",
    price: 0.08506595,
    usd_value: 52240,
    last_seen: new Date(Date.now() - 40000).toISOString(),
  },
  {
    symbol: "AKE",
    exchange: "binance_alpha",
    price: 0.01954757,
    usd_value: 41093,
    last_seen: new Date(Date.now() - 85000).toISOString(),
  },
  {
    symbol: "DOS",
    exchange: "binance_alpha",
    price: 0.299919,
    usd_value: 20702,
    last_seen: new Date(Date.now() - 140000).toISOString(),
  },
];

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [walls, setWalls] = useState<BidWall[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Hydration fix ke liye state
  const [startOfDay, setStartOfDay] = useState<Date | null>(null);

  // Filter & Modal states
  const [selectedTf, setSelectedTf] = useState<TimeframeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSignalModal, setActiveSignalModal] = useState<Signal | null>(null);

  // Set start of day on client side
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStartOfDay(now);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sigRes, statsRes, wallsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/signals`, { cache: "no-store" }), // Dashboard endpoint
        fetch(`${API_BASE_URL}/api/signals/stats`, { cache: "no-store" }),   // Dashboard endpoint
        fetch(`${API_BASE_URL}/api/walls/active`, { cache: "no-store" }),   // Dashboard endpoint
      ]);

      if (!sigRes.ok || !statsRes.ok || !wallsRes.ok) {
        throw new Error(`API returned status ${sigRes.status}`);
      }

      const [sigData, statsData, wallsData] = await Promise.all([
        sigRes.json(),
        statsRes.json(),
        wallsRes.json(),
      ]);

      setSignals(Array.isArray(sigData) ? sigData : sigData.signals || []);
      setStats(statsData);
      setWalls(Array.isArray(wallsData) ? wallsData : wallsData.walls || []);
      setUsingFallback(false);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Gracefully fall back to live preview data if FastAPI isn't reachable yet
      if (signals.length === 0) {
        setSignals(FALLBACK_SIGNALS);
        setStats(FALLBACK_STATS);
        setWalls(FALLBACK_WALLS);
        setUsingFallback(true);
      } else {
        setError("Connection to FastAPI interrupted. Retrying...");
      }
    } finally {
      setIsLoading(false);
    }
  }, [signals.length]);

  // Initial fetch + 7-second interval polling
  useEffect(() => {
    fetchDashboardData();
    if (!isPolling) return;

    const timer = setInterval(() => {
      fetchDashboardData();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [fetchDashboardData, isPolling]);

  // Filtered Signals for the Main Table
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      const matchesTf =
        selectedTf === "ALL" || s.timeframe.toLowerCase() === selectedTf.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        s.symbol.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        s.structure.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesTf && matchesSearch;
    });
  }, [signals, selectedTf, searchQuery]);

  // KPI computations (Fixed Hydration)
  const signalsTodayCount = useMemo(() => {
    if (!startOfDay) return 0;
    return signals.filter((s) => new Date(s.detected_at) >= startOfDay).length || signals.length;
  }, [signals, startOfDay]);

  const activeCoinsCount = useMemo(() => {
    const unique = new Set([
      ...walls.map((w) => w.symbol.trim().toUpperCase()),
      ...signals.map((s) => s.symbol.trim().toUpperCase()),
    ]);
    return unique.size || 293;
  }, [walls, signals]);

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

        {/* Section 2 & 3: Main Signal Feed (7 cols) + Live Bid Walls Radar (5 cols) */}
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
            />
          </div>

          <div className="xl:col-span-5 2xl:col-span-4">
            <WallTable
              walls={walls}
              isLoading={isLoading}
              onSelectSymbol={(sym) => setSearchQuery(sym)}
            />
          </div>
        </div>
      </main>

      {/* Section 4: Signal Deep-Dive Modal */}
      <SignalModal
        signal={activeSignalModal}
        onClose={() => setActiveSignalModal(null)}
      />
    </div>
  );
}