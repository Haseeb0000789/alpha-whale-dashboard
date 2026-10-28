// types/types.ts

export interface Signal {
  id?: number;
  symbol: string;
  structure: string; // e.g., "double_bottom", "bullish_flag", "cup_and_handle"
  timeframe: string; // e.g., "15m", "1h", "4h", "1d"
  confidence: number; // 4-Pillar total score out of 100
  p1_volume_score: number; // Max 25
  p2_wall_score: number; // Max 25
  p3_structure_score: number; // Max 40
  p4_btc_score: number; // Max 10
  entry_low: number;
  entry_high: number;
  stop_loss: number;
  tp1_price: number;
  tp2_price: number;
  is_extended: boolean;
  detected_at: string; // ISO Date
  smc_bos: boolean;
  smc_ob: boolean;
  smc_retest?: boolean;
  volume_ratio?: number;
  taker_buy_ratio?: number;
  level_price?: number;
  breakout_price?: number;
  wall_price?: number | null;
  wall_usd?: number | null;
  wall_respect_rate?: number | null;
}

export interface SignalStats {
  period_days?: number;
  total_signals: number;
  finalized?: number;
  win_rate_pct: number;
  tp1_rate_pct: number;
  tp2_rate_pct: number;
  avg_max_gain_pct: number;
  avg_max_drawdown_pct: number;
  wall_backed_win_rate_pct?: number;
  breakeven_rate_pct?: number;
  sl_rate_pct?: number;
}

export interface BidWall {
  id?: number;
  symbol: string;
  exchange: string;
  price: number;
  usd_value: number;
  last_seen: string; // ISO Date (also handles last_seen_at fallback)
  last_seen_at?: string;
}

export type TimeframeFilter = "ALL" | "15m" | "1h" | "4h" | "1d";

// Helper to format micro-cap and standard crypto prices cleanly
export function formatCryptoPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price) || price === 0) {
    return "—";
  }
  if (price >= 1000) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (price >= 0.01) {
    return price.toPrecision(5).replace(/\.?0+$/, "");
  }
  return price.toPrecision(4).replace(/\.?0+$/, "");
}

// Helper to format snake_case pattern names into clean badges
export function formatPatternName(structure: string): string {
  if (!structure) return "Breakout";
  return structure
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper to compute relative time ("2m ago", "14s ago")
export function formatRelativeTime(isoDate: string | undefined): string {
  if (!isoDate) return "Just now";
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "Just now";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}