// types/types.ts

export type SignalOutcomeStatus =
  | "TP2_HIT"
  | "TP1_HIT"
  | "BREAKEVEN"
  | "SL_HIT"
  | "IN_PLAY";

export interface Signal {
  id?: number;
  symbol: string;
  structure: string;
  timeframe: string;
  confidence: number;
  p1_volume_score: number;
  p2_wall_score: number;
  p3_structure_score: number;
  p4_btc_score: number;
  entry_low: number;
  entry_high: number;
  stop_loss: number;
  tp1_price: number;
  tp2_price: number;
  volume_ratio: number;
  taker_buy_ratio: number;
  smc_bos: boolean;
  smc_ob: boolean;
  smc_retest?: boolean;
  is_extended: boolean;
  detected_at?: string;
  level_price?: number;
  breakout_price?: number;
  wall_price?: number | null;
  wall_usd?: number | null;
  wall_respect_rate?: number | null;
  
  // Live Outcome Tracking Fields
  outcome_status?: SignalOutcomeStatus;
  outcome_finalized?: boolean;
  hit_tp1?: boolean;
  hit_tp2?: boolean;
  breakeven_exit?: boolean;
  hit_sl?: boolean;
  max_gain_pct?: number;
  max_drawdown_pct?: number;
}

export interface ExchangeWallItem {
  exchange: string;
  price: number;
  usd_value: number;
  distance_pct: number;
}

export interface BidWall {
  id?: number;
  symbol: string;
  mid_price?: number;
  exchange: string;
  price: number;
  usd_value: number;
  distance_pct?: number;
  entry_score?: number;
  relevance_score?: number;
  respect_rate?: number;
  scans_seen?: number;
  step_up_count?: number;
  is_live_watch?: boolean;
  positives?: string[];
  warnings?: string[];
  exchange_walls?: ExchangeWallItem[];
  last_seen?: string;
  last_seen_at?: string;
}

// NAYA: Stats breakdown interfaces (Telegram /stats mapping)
export interface PatternStatItem {
  structure: string;
  count: number;
  avg_confidence: number;
}

export interface TimeframeStatItem {
  timeframe: string;
  count: number;
}

// UPDATED: SignalStats interface
export interface SignalStats {
  period_days?: number;
  total_signals: number;
  finalized?: number;
  win_rate_pct: number;
  wall_backed_win_rate_pct?: number;
  tp1_rate_pct: number;
  tp2_rate_pct: number;
  breakeven_rate_pct?: number;
  sl_rate_pct?: number;
  avg_max_gain_pct: number;
  avg_max_drawdown_pct: number;
  by_structure?: PatternStatItem[];
  by_timeframe?: TimeframeStatItem[];
}

// Upgrade 2: TradingView Lightweight Chart OHLC interface
export interface OHLCCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

// Upgrade 3: Order Book Depth Chart point interface
export interface DepthPoint {
  price: number;
  priceLabel: string;
  bidsUsd: number | null;
  asksUsd: number | null;
}

// Upgrade 1: Coin Detail Page interfaces
export interface CoinWallHistoryItem {
  id: number;
  exchange: string;
  price: number;
  usd_value: number;
  status: "HELD" | "PULLED" | "BROKEN" | "ACTIVE";
  respect_rate: number;
  detected_at: string;
}

export interface CoinDetailData {
  symbol: string;
  current_price: number;
  change_24h_pct: number;
  win_rate_pct: number;
  total_signals: number;
  active_walls_count: number;
  respect_rate_pct: number;
  signals: Signal[];
  wall_history: CoinWallHistoryItem[];
  ohlc?: OHLCCandle[];
  depth?: DepthPoint[];
}

// Upgrade 4: Cumulative PnL Equity Curve point
export interface EquityCurvePoint {
  dateLabel: string;
  winRate: number;
  dailyGainPct: number;
  cumulativePnlPct: number;
  signalsCount: number;
}

export type TimeframeFilter = "ALL" | "15m" | "1h" | "4h" | "1d";

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

export function formatPatternName(structure: string): string {
  if (!structure) return "Breakout";
  return structure
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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