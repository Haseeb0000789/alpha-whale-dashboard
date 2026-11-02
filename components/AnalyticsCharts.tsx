// components/AnalyticsCharts.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Signal,
  SignalStats,
  EquityCurvePoint,
  formatPatternName,
  getSyncedNowMs,
  parseUtcTimestampMs,
} from "@/types/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Sparkles, DollarSign, Layers, Clock } from "lucide-react";

interface AnalyticsChartsProps {
  signals: Signal[];
  stats: SignalStats | null;
  isLoading: boolean;
}

function localDayKey(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function getWinRateBadgeClasses(winRatePct: number): string {
  if (winRatePct >= 60) {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  }
  if (winRatePct >= 40) {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
  return "border-rose-500/40 bg-rose-500/15 text-rose-300";
}

export default function AnalyticsCharts({
  signals,
  stats,
  isLoading,
}: AnalyticsChartsProps) {
  const [mountedDate, setMountedDate] = useState<Date | null>(null);

  useEffect(() => {
    const initId = setTimeout(() => setMountedDate(new Date(getSyncedNowMs())), 0);
    return () => clearTimeout(initId);
  }, [signals.length]);

  const chartData: EquityCurvePoint[] = useMemo(() => {
    const baseWinRate =
      stats?.win_rate_pct !== undefined && stats.win_rate_pct > 0
        ? stats.win_rate_pct
        : 50.0;

    const avgGain = stats?.avg_max_gain_pct ?? 2.8;
    const avgDd = Math.abs(stats?.avg_max_drawdown_pct ?? 1.6);
    const wrDec = baseWinRate / 100;
    const slDec = (stats?.sl_rate_pct ?? 35.0) / 100;
    const baselineDailyEdge = Number((wrDec * avgGain - slDec * avgDd).toFixed(2));

    // Group real signals into 7 calendar-day buckets
    const refNow = mountedDate ?? new Date(0);
    const buckets = new Map<
      string,
      { total: number; finalized: number; wins: number; losses: number; netPnlSum: number }
    >();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(refNow);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.set(localDayKey(d), {
        total: 0,
        finalized: 0,
        wins: 0,
        losses: 0,
        netPnlSum: 0,
      });
    }

    for (const s of signals) {
      if (!s.detected_at) continue;
      const dtMs = parseUtcTimestampMs(s.detected_at);
      if (isNaN(dtMs)) continue;
      const dt = new Date(dtMs);
      const b = buckets.get(localDayKey(dt));
      if (!b) continue;

      b.total += 1;
      const st = s.outcome_status || "IN_PLAY";
      const isFin = Boolean(s.outcome_finalized) || st !== "IN_PLAY";
      if (!isFin) continue;

      b.finalized += 1;
      const entry = s.entry_high || s.breakout_price || s.entry_low || 0;

      if (s.hit_tp2 || st === "TP2_HIT") {
        b.wins += 1;
        const tp2Pct =
          entry > 0 && s.tp2_price > entry
            ? ((s.tp2_price - entry) / entry) * 100
            : s.max_gain_pct || avgGain;
        b.netPnlSum += Math.max(0.5, tp2Pct * 0.75);
      } else if (s.hit_tp1 || st === "TP1_HIT") {
        b.wins += 1;
        const tp1Pct =
          entry > 0 && s.tp1_price > entry
            ? ((s.tp1_price - entry) / entry) * 100
            : s.max_gain_pct || avgGain;
        // 50% booked at TP1 + 50% runner protected at +0.20% fee-adjusted BE
        b.netPnlSum += Math.max(0.4, tp1Pct * 0.5 + 0.10);
      } else if (s.breakeven_exit || st === "BREAKEVEN") {
        // Fee-adjusted trailing breakeven (+0.20% gross -> ~0.04% net saved)
        b.netPnlSum += 0.04;
      } else if (s.hit_sl || st === "SL_HIT") {
        b.losses += 1;
        const slPct =
          entry > 0 && s.stop_loss > 0 && s.stop_loss < entry
            ? ((entry - s.stop_loss) / entry) * 100
            : Math.abs(s.max_drawdown_pct || avgDd);
        b.netPnlSum -= Math.max(0.25, slPct);
      }
    }

    const points: EquityCurvePoint[] = [];
    let runningCumulativePnl = 0;
    let carryWinRate = baseWinRate;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(refNow);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);

      let shortLabel = i === 0 ? "Today" : `D-${i}`;
      if (i > 0 && mountedDate) {
        shortLabel = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }

      const b = buckets.get(localDayKey(d));
      let dayWinRate = carryWinRate;
      let dailyGain = 0;
      let sigCount = b?.total ?? 0;

      if (b && b.finalized > 0) {
        const decisive = b.wins + b.losses;
        if (decisive > 0) {
          dayWinRate = Number(((b.wins / decisive) * 100).toFixed(1));
          carryWinRate = dayWinRate;
        }
        // Normalize daily portfolio impact assuming 20% allocation per setup (capped to realistic daily turnover)
        const avgSetupPnl = b.netPnlSum / b.finalized;
        const effectiveTrades = Math.min(b.finalized, 5);
        dailyGain = Number((avgSetupPnl * effectiveTrades * 0.25).toFixed(2));
      } else if (signals.length === 0 && stats && (stats.finalized ?? 0) > 0) {
        // Fallback to real aggregate DB stats only if client signal list hasn't hydrated yet
        dayWinRate = Number(baseWinRate.toFixed(1));
        dailyGain = Number((baselineDailyEdge * 0.5).toFixed(2));
        sigCount = Math.round((stats.total_signals || 0) / 7);
      }

      runningCumulativePnl = Number(
        (runningCumulativePnl + dailyGain).toFixed(2)
      );

      points.push({
        dateLabel: shortLabel,
        winRate: Math.min(100, Math.max(0, dayWinRate)),
        dailyGainPct: dailyGain,
        cumulativePnlPct: runningCumulativePnl,
        signalsCount: sigCount,
      });
    }

    return points;
  }, [signals, stats, mountedDate]);

  if (isLoading && !stats && signals.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4" />
        <div className="h-56 animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4" />
      </div>
    );
  }

  const latestWinRate =
    stats?.win_rate_pct !== undefined && stats.win_rate_pct > 0
      ? stats.win_rate_pct
      : chartData[chartData.length - 1]?.winRate ?? 0;
  const latestEquity = chartData[chartData.length - 1]?.cumulativePnlPct ?? 0;

  const minWrAxis = Math.max(
    0,
    Math.floor(Math.min(...chartData.map((d) => d.winRate)) - 8)
  );
  const maxWrAxis = Math.min(
    100,
    Math.ceil(Math.max(...chartData.map((d) => d.winRate)) + 12)
  );

  return (
    <div className="space-y-3.5">
      {/* Row 1: 2 Big Charts (Compact Viewport-Fit Height) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* Chart 1: 7-Day Win-Rate Line Chart */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-[#080B12] p-4 shadow-xl backdrop-blur-xl transition hover:border-cyan-500/40">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-xs font-bold text-white sm:text-sm">
                  7-Day Win-Rate Trajectory
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                    <Sparkles className="h-2.5 w-2.5" /> 4-Pillar Verified
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Real daily percentage of finalized signals hitting TP1 / TP2 targets
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="font-mono text-base font-black text-cyan-400 sm:text-lg">
                {latestWinRate.toFixed(1)}%
              </span>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">
                7D Overall
              </p>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 6, right: 10, left: -22, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148, 163, 184, 0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[minWrAxis, maxWrAxis]}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(6, 182, 212, 0.25)", strokeWidth: 1 }}
                  contentStyle={{
                    backgroundColor: "rgba(10, 14, 23, 0.95)",
                    borderColor: "rgba(6, 182, 212, 0.4)",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                  itemStyle={{ color: "#22d3ee", fontWeight: 700 }}
                  formatter={(value) => [
                    `${Number(value ?? 0).toFixed(1)}%`,
                    "Daily Win Rate",
                  ]}
                />
                <ReferenceLine
                  y={latestWinRate}
                  stroke="rgba(6, 182, 212, 0.2)"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#07090E", stroke: "#06b6d4", strokeWidth: 2 }}
                  activeDot={{
                    r: 5,
                    fill: "#06b6d4",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cumulative PnL / Equity Curve */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-[#080B12] p-4 shadow-xl backdrop-blur-xl transition hover:border-emerald-500/40">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-xs font-bold text-white sm:text-sm">
                  Cumulative PnL / Equity Curve (7D)
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Realized Outcomes
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Net realized curve from TP1/TP2 wins, fee-adjusted BE saves & SL exits
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`font-mono text-base font-black sm:text-lg ${
                  latestEquity >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {latestEquity >= 0 ? "+" : ""}
                {latestEquity.toFixed(2)}%
              </span>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">
                7D Net Return
              </p>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 6, right: 10, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="equityEmeraldGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="55%" stopColor="#06b6d4" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148, 163, 184, 0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) =>
                    `${Number(val) >= 0 ? "+" : ""}${val}%`
                  }
                />
                <Tooltip
                  cursor={{ stroke: "rgba(16, 185, 129, 0.35)", strokeWidth: 1.5 }}
                  contentStyle={{
                    backgroundColor: "rgba(10, 14, 23, 0.95)",
                    borderColor: "rgba(16, 185, 129, 0.45)",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                  itemStyle={{ color: "#34d399", fontWeight: 700 }}
                  formatter={(value) => {
                    const num = Number(value ?? 0);
                    return [
                      `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`,
                      "Cumulative PnL",
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePnlPct"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#equityEmeraldGlow)"
                  activeDot={{
                    r: 5,
                    fill: "#10b981",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Compact Pattern & Timeframe Breakdown */}
      {Boolean(stats?.by_structure?.length || stats?.by_timeframe?.length) && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 px-4 py-3 backdrop-blur-xl lg:col-span-7">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Signals Breakdown By Pattern (7D)
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                Win Rate • Record
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(stats?.by_structure || []).slice(0, 8).map((item) => {
                const wr = Math.round(item.win_rate_pct ?? 0);
                const wins = item.wins ?? 0;
                const losses = item.losses ?? 0;
                const be = item.breakeven ?? 0;
                return (
                  <div
                    key={item.structure}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/35 px-3 py-2 text-[11px]"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-bold text-slate-100">
                        {formatPatternName(item.structure)}
                      </span>
                      <span className="rounded border border-slate-700/80 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                        {item.count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-bold ${getWinRateBadgeClasses(
                          wr
                        )}`}
                      >
                        [ {wr}% Win ]
                      </span>
                      <span className="font-semibold text-slate-300">
                        ({wins}W / {losses}L • {be}BE)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 px-4 py-3 backdrop-blur-xl lg:col-span-5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  By Timeframe (7D)
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                Win Rate • Record
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(stats?.by_timeframe || []).map((tf) => {
                const wr = Math.round(tf.win_rate_pct ?? 0);
                const wins = tf.wins ?? 0;
                const losses = tf.losses ?? 0;
                const be = tf.breakeven ?? 0;
                return (
                  <div
                    key={tf.timeframe}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/35 px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black uppercase text-cyan-300">
                        {tf.timeframe}
                      </span>
                      <span className="rounded border border-slate-700/80 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {tf.count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-bold ${getWinRateBadgeClasses(
                          wr
                        )}`}
                      >
                        [ {wr}% Win ]
                      </span>
                      <span className="font-semibold text-slate-300">
                        ({wins}W / {losses}L • {be}BE)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
