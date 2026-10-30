// components/TradingChart.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  UTCTimestamp,
  ISeriesApi,
  CandlestickSeries,
} from "lightweight-charts";
import { OHLCCandle, formatCryptoPrice } from "@/types/types";
import { CandlestickChart, Loader2 } from "lucide-react";

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

// Fallback mock data generator (Agar API fail ho jaye)
function generateBreakoutCandles(
  entryPrice: number,
  stopLoss: number,
  barCount = 48
): OHLCCandle[] {
  const ref = entryPrice > 0 ? entryPrice : 0.025;
  const volatility = Math.max(Math.abs(ref - stopLoss) * 0.32, ref * 0.012);
  const nowSec = Math.floor(Date.now() / 1000);
  const stepSec = 900; // 15m bars

  const list: OHLCCandle[] = [];
  let cursor = ref - volatility * 1.6;

  for (let i = barCount; i >= 0; i--) {
    const t = nowSec - i * stepSec;
    const progress = (barCount - i) / barCount;
    const wave = Math.sin(progress * Math.PI * 3.2) * volatility * 0.55;
    const breakoutPush = i <= 5 ? ((6 - i) / 6) * volatility * 1.4 : 0;

    const open = cursor;
    const rawClose =
      i === 0
        ? ref
        : ref - volatility * (1 - progress * 0.85) + wave + breakoutPush;
    const close = Math.max(ref * 0.5, rawClose);

    const wickUp = Math.abs(Math.cos(i * 1.7)) * volatility * 0.45;
    const wickDown = Math.abs(Math.sin(i * 2.3)) * volatility * 0.45;

    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    list.push({
      time: t,
      open: Number(open.toPrecision(6)),
      high: Number(high.toPrecision(6)),
      low: Number(low.toPrecision(6)),
      close: Number(close.toPrecision(6)),
    });

    cursor = close;
  }

  return list;
}

export default function TradingChart({
  symbol,
  timeframe = "4h",
  entryPrice,
  stopLoss,
  tp1Price,
  tp2Price,
  candles,
  height = 270,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [chartData, setChartData] = useState<OHLCCandle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Real Data
  useEffect(() => {
    // Agar parent se candles pass ho chuki hain, toh fetch mat karein
    if (candles && candles.length > 5) {
      setChartData(candles);
      setIsLoading(false);
      return;
    }

    const fetchLiveKlines = async () => {
      setIsLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        // Backend endpoint call
        const res = await fetch(`${API_URL}/api/coin/${symbol}/klines?timeframe=${timeframe}&limit=150`);
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setChartData(data);
          } else {
            // Fallback to mock if data is empty
            setChartData(generateBreakoutCandles(entryPrice, stopLoss));
          }
        } else {
          setChartData(generateBreakoutCandles(entryPrice, stopLoss));
        }
      } catch (err) {
        console.error("Failed to fetch live klines:", err);
        setChartData(generateBreakoutCandles(entryPrice, stopLoss));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveKlines();
  }, [symbol, timeframe, candles, entryPrice, stopLoss]);

  // 2. Initialize Chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

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
        scaleMargins: { top: 0.14, bottom: 0.14 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    const precision =
      entryPrice < 0.01 ? 6 : entryPrice < 1 ? 5 : entryPrice < 100 ? 4 : 2;
    const minMove = Number((1 / Math.pow(10, precision)).toFixed(precision));

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185",
      priceFormat: {
        type: "price",
        precision,
        minMove,
      },
    });

    candleSeriesRef.current = candleSeries;

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length || !chartInstanceRef.current) return;
      const { width } = entries[0].contentRect;
      chartInstanceRef.current.applyOptions({ width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [height, entryPrice]);

  // 3. Update Chart Data & Price Lines when data changes
  useEffect(() => {
    if (!candleSeriesRef.current || chartData.length === 0) return;

    // Set Real/Mock Data
    candleSeriesRef.current.setData(
      chartData.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Remove old price lines
    // (Lightweight charts doesn't have a direct remove all, but setting data resets the scale. 
    // We will just create them here once data is set)
    
    if (tp2Price > 0) {
      candleSeriesRef.current.createPriceLine({
        price: tp2Price,
        color: "#a855f7",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "TP2 (2.5R)",
      });
    }

    if (tp1Price > 0) {
      candleSeriesRef.current.createPriceLine({
        price: tp1Price,
        color: "#10b981",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "TP1 (1.5R)",
      });
    }

    if (entryPrice > 0) {
      candleSeriesRef.current.createPriceLine({
        price: entryPrice,
        color: "#06b6d4",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "ENTRY",
      });
    }

    if (stopLoss > 0) {
      candleSeriesRef.current.createPriceLine({
        price: stopLoss,
        color: "#f43f5e",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "STOP LOSS",
      });
    }

    chartInstanceRef.current?.timeScale().fitContent();
  }, [chartData, entryPrice, stopLoss, tp1Price, tp2Price]);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-xl relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CandlestickChart className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            {symbol.trim().toUpperCase()}/USDT • {timeframe.toUpperCase()} Live Structure
          </h3>
        </div>

        {/* Price Line Legend Pills */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
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

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-xl">
            <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full overflow-hidden rounded-xl" />
      </div>
    </div>
  );
}