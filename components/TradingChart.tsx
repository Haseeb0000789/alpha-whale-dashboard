// components/TradingChart.tsx
"use client";

import React, { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  UTCTimestamp,
  CandlestickSeries, // <--- YEH NAYA IMPORT ADD KAREIN
} from "lightweight-charts";
import { OHLCCandle, formatCryptoPrice } from "@/types/types";
import { CandlestickChart } from "lucide-react";

interface TradingChartProps {
  symbol: string;
  timeframe?: string;
  entryPrice: number;
  stopLoss: number;
  tp1Price: number;
  tp2Price: number;
  candles?: OHLCCandle[];
  height?: number;
}

function generateBreakoutCandles(
  entryPrice: number,
  stopLoss: number,
  barCount = 48
): OHLCCandle[] {
  const ref = entryPrice > 0 ? entryPrice : 0.1743;
  const volatility = Math.max(Math.abs(ref - stopLoss) * 0.32, ref * 0.012);
  // Anchor to 15-minute boundary so polling doesn't shift timestamps every 7 seconds
  const nowSec = Math.floor(Date.now() / (900 * 1000)) * 900;
  const stepSec = 900;

  const list: OHLCCandle[] = [];
  let cursor = ref - volatility * 1.5;

  for (let i = barCount; i >= 0; i--) {
    const t = nowSec - i * stepSec;
    const progress = (barCount - i) / barCount;
    const wave = Math.sin(progress * Math.PI * 3.2) * volatility * 0.5;
    const breakoutPush = i <= 5 ? ((6 - i) / 6) * volatility * 1.35 : 0;

    const open = cursor;
    const rawClose =
      i === 0
        ? ref
        : ref - volatility * (1 - progress * 0.85) + wave + breakoutPush;
    const close = Math.max(ref * 0.4, rawClose);

    const wickUp = Math.abs(Math.cos(i * 1.7)) * volatility * 0.4;
    const wickDown = Math.abs(Math.sin(i * 2.3)) * volatility * 0.4;

    list.push({
      time: t,
      open: Number(open.toPrecision(6)),
      high: Number((Math.max(open, close) + wickUp).toPrecision(6)),
      low: Number((Math.min(open, close) - wickDown).toPrecision(6)),
      close: Number(close.toPrecision(6)),
    });

    cursor = close;
  }

  return list;
}

export default function TradingChart({
  symbol,
  timeframe = "1h",
  entryPrice,
  stopLoss,
  tp1Price,
  tp2Price,
  candles,
  height = 260,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const chartData = useMemo(() => {
    if (candles && candles.length > 5) return candles;
    return generateBreakoutCandles(entryPrice, stopLoss);
  }, [candles, entryPrice, stopLoss]);

  // 1. Initialize Chart Instance Once
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Clear any leftover canvas elements to prevent duplicate rendering
    container.innerHTML = "";

    const precision =
      entryPrice < 0.01 ? 6 : entryPrice < 1 ? 5 : entryPrice < 100 ? 4 : 2;
    const minMove = Number((1 / Math.pow(10, precision)).toFixed(precision));

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.06)" },
        horzLines: { color: "rgba(148, 163, 184, 0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(6, 182, 212, 0.45)",
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: "rgba(6, 182, 212, 0.45)",
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185",
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: "price",
        precision,
        minMove,
      },
      // FIX 1: Force chart Y-axis to always include SL, Entry, TP1, and TP2 lines!
           // FIX 1: Force chart Y-axis to always include SL, Entry, TP1, and TP2 lines!
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
        const res = original();
        if (res !== null && res.priceRange !== null) {
          const prices = [entryPrice, stopLoss, tp1Price, tp2Price].filter((p) => p > 0);
          if (prices.length > 0) {
            const minLine = Math.min(...prices);
            const maxLine = Math.max(...prices);
            const pad = (maxLine - minLine) * 0.08;
            return {
              priceRange: {
                minValue: Math.min(res.priceRange.minValue, minLine - pad),
                maxValue: Math.max(res.priceRange.maxValue, maxLine + pad),
              },
            };
          }
        }
        return res;
      },
    });

    chartInstanceRef.current = chart;
    seriesRef.current = candleSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length || !chartInstanceRef.current) return;
      const { width } = entries[0].contentRect;
      chartInstanceRef.current.applyOptions({ width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      priceLinesRef.current = [];
      seriesRef.current = null;
      chartInstanceRef.current = null;
      chart.remove();
    };
  }, [height, symbol, entryPrice, stopLoss, tp1Price, tp2Price]); // <-- Prices ko dependencies mein add kiya taake change par chart update ho

  // 2. Update Candles & Single Clean Set of Price Lines Without Duplicating
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartInstanceRef.current;
    if (!series || !chart) return;

    const precision =
      entryPrice < 0.01 ? 6 : entryPrice < 1 ? 5 : entryPrice < 100 ? 4 : 2;
    const minMove = Number((1 / Math.pow(10, precision)).toFixed(precision));
    series.applyOptions({
      priceFormat: { type: "price", precision, minMove },
    });

    series.setData(
      chartData.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Remove all existing price lines first so they NEVER stack up 3x!
    for (const oldLine of priceLinesRef.current) {
      try {
        series.removePriceLine(oldLine);
      } catch {
        // Ignore if already removed
      }
    }
    priceLinesRef.current = [];

    if (tp2Price > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: tp2Price,
          color: "#a855f7",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "TP2",
        })
      );
    }

    if (tp1Price > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: tp1Price,
          color: "#10b981",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "TP1 (1.5R)",
        })
      );
    }

    if (entryPrice > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: entryPrice,
          color: "#06b6d4",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "ENTRY",
        })
      );
    }

    if (stopLoss > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: stopLoss,
          color: "#f43f5e",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "SL",
        })
      );
    }

    chart.timeScale().fitContent();
  }, [chartData, entryPrice, stopLoss, tp1Price, tp2Price]);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CandlestickChart className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            {symbol.trim().toUpperCase()}/USDT • {timeframe.toUpperCase()} Live Structure
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
            Entry ${formatCryptoPrice(entryPrice)}
          </span>
          <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-rose-300">
            SL ${formatCryptoPrice(stopLoss)}
          </span>
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
            TP1 ${formatCryptoPrice(tp1Price)}
          </span>
          <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-purple-300">
            TP2 ${formatCryptoPrice(tp2Price)}
          </span>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full overflow-hidden rounded-xl" />
    </div>
  );
}