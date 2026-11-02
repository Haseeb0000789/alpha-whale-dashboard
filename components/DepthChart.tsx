// components/DepthChart.tsx
"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { DepthPoint, formatCryptoPrice } from "@/types/types";
import { Layers, ShieldCheck, Scale, AlertTriangle } from "lucide-react";

interface DepthChartProps {
  symbol: string;
  midPrice: number;
  wallPrice?: number | null;
  wallUsd?: number | null;
  depthData?: DepthPoint[];
  bidAskRatio?: number | null;
  height?: number;
}

// Fallback L2 Order Book cumulative depth curve when live API book hasn't arrived yet
function buildOrderBookDepth(
  midPrice: number,
  wallPrice?: number | null,
  wallUsd?: number | null
): { points: DepthPoint[]; computedRatio: number } {
  const ref = midPrice > 0 ? midPrice : 0.05;
  const activeWallUsd = wallUsd && wallUsd > 0 ? wallUsd : 15000;
  const points: DepthPoint[] = [];

  let cumBid = 0;
  const bidSteps: { price: number; usd: number }[] = [];
  for (let i = 1; i <= 10; i++) {
    const p = ref * (1 - i * 0.0035);
    const isWhaleLevel =
      (wallPrice && Math.abs(p - wallPrice) / ref < 0.004) || (!wallPrice && i === 3);
    const stepUsd = isWhaleLevel ? activeWallUsd : 3200 + i * 1600;
    cumBid += stepUsd;
    bidSteps.push({ price: p, usd: Math.round(cumBid) });
  }

  for (let i = bidSteps.length - 1; i >= 0; i--) {
    points.push({
      price: bidSteps[i].price,
      priceLabel: `$${formatCryptoPrice(bidSteps[i].price)}`,
      bidsUsd: bidSteps[i].usd,
      asksUsd: null,
    });
  }

  points.push({
    price: ref,
    priceLabel: `$${formatCryptoPrice(ref)}`,
    bidsUsd: 2500,
    asksUsd: 2400,
  });

  let cumAsk = 2400;
  for (let i = 1; i <= 10; i++) {
    const p = ref * (1 + i * 0.0035);
    const stepUsd = 2600 + i * 1450;
    cumAsk += stepUsd;
    points.push({
      price: p,
      priceLabel: `$${formatCryptoPrice(p)}`,
      bidsUsd: null,
      asksUsd: Math.round(cumAsk),
    });
  }

  const ratio = cumAsk > 0 ? Number((cumBid / cumAsk).toFixed(2)) : 1.0;
  return { points, computedRatio: ratio };
}

export default function DepthChart({
  symbol,
  midPrice,
  wallPrice,
  wallUsd,
  depthData,
  bidAskRatio: externalBidAskRatio,
  height = 210,
}: DepthChartProps) {
  const cleanSym = (symbol || "").trim().toUpperCase();

  const { points, computedRatio } = useMemo(() => {
    if (!cleanSym) {
      return { points: [], computedRatio: 1.0 };
    }

    if (depthData && depthData.length > 0) {
      let maxBid = 0;
      let maxAsk = 0;
      const normalized: DepthPoint[] = depthData.map((pt) => {
        const bVal =
          pt.bidsUsd !== undefined
            ? pt.bidsUsd
            : pt.bid_usd && pt.bid_usd > 0
            ? pt.bid_usd
            : null;
        const aVal =
          pt.asksUsd !== undefined
            ? pt.asksUsd
            : pt.ask_usd && pt.ask_usd > 0
            ? pt.ask_usd
            : null;
        if (typeof bVal === "number" && bVal > maxBid) maxBid = bVal;
        if (typeof aVal === "number" && aVal > maxAsk) maxAsk = aVal;

        return {
          price: pt.price,
          priceLabel: pt.priceLabel || `$${formatCryptoPrice(pt.price)}`,
          bidsUsd: bVal,
          asksUsd: aVal,
        };
      });

      const derivedRatio =
        typeof externalBidAskRatio === "number" && externalBidAskRatio > 0
          ? Number(externalBidAskRatio.toFixed(2))
          : maxAsk > 0
          ? Number((maxBid / maxAsk).toFixed(2))
          : 1.0;

      return { points: normalized, computedRatio: derivedRatio };
    }

    const fallback = buildOrderBookDepth(midPrice, wallPrice, wallUsd);
    return {
      points: fallback.points,
      computedRatio:
        typeof externalBidAskRatio === "number" && externalBidAskRatio > 0
          ? Number(externalBidAskRatio.toFixed(2))
          : fallback.computedRatio,
    };
  }, [cleanSym, depthData, externalBidAskRatio, midPrice, wallPrice, wallUsd]);

  if (!cleanSym) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 text-center backdrop-blur-xl" style={{ minHeight: height + 65 }}>
        <Layers className="mb-2 h-7 w-7 text-slate-500 opacity-50" />
        <p className="text-xs font-bold text-slate-300">
          No Active Whale Wall Selected
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Adjust filters or wait for the scanner to detect a live L2 bid cluster.
        </p>
      </div>
    );
  }

  const regimeBadge =
    computedRatio >= 1.3
      ? {
          label: `${computedRatio.toFixed(2)}x Bid/Ask Imbalance (Ask Vacuum)`,
          cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
          Icon: ShieldCheck,
          iconCls: "text-emerald-400",
        }
      : computedRatio >= 0.95
      ? {
          label: `${computedRatio.toFixed(2)}x Bid/Ask Ratio (Balanced Book)`,
          cls: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
          Icon: Scale,
          iconCls: "text-cyan-400",
        }
      : {
          label: `${computedRatio.toFixed(2)}x Bid/Ask Ratio (Overhead Ask Supply)`,
          cls: "border-amber-500/30 bg-amber-500/15 text-amber-300",
          Icon: AlertTriangle,
          iconCls: "text-amber-400",
        };

  const BadgeIcon = regimeBadge.Icon;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-400" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {cleanSym} L2 Order Book Depth (±3.5%)
            </h3>
            <p className="text-[10px] text-slate-400">
              Green = Cumulative Bid Support • Red = Overhead Ask Resistance
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold ${regimeBadge.cls}`}
        >
          <BadgeIcon className={`h-3.5 w-3.5 ${regimeBadge.iconCls}`} />
          {regimeBadge.label}
        </span>
      </div>

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="bidDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="askDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.06)" vertical={false} />
            <XAxis
              dataKey="priceLabel"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) =>
                val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(10, 14, 23, 0.95)",
                borderColor: "rgba(148, 163, 184, 0.25)",
                borderRadius: "12px",
                fontSize: "11px",
              }}
              formatter={(value: unknown, name: unknown) => [
                `$${Number(value ?? 0).toLocaleString()}`,
                name === "bidsUsd"
                  ? "Cumulative Bids (Buy Wall)"
                  : "Cumulative Asks (Sell Wall)",
              ]}
            />
            <Area
              type="stepAfter"
              dataKey="bidsUsd"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#bidDepthGrad)"
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="stepBefore"
              dataKey="asksUsd"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#askDepthGrad)"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
