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
  extension_pct?: number;
  detected_at?: string;
  level_price?: number;
  breakout_price?: number;
  wall_price?: number | null;
  wall_usd?: number | null;
  wall_respect_rate?: number | null;
  // Outcome Tracking Fields
  outcome_status?: SignalOutcomeStatus;
  outcome_finalized?: boolean;
  hit_tp1?: boolean;
  hit_tp2?: boolean;
  breakeven_exit?: boolean;
  hit_sl?: boolean;
  max_gain_pct?: number;
  max_drawdown_pct?: number;
  // New Main CEX Spot Quant Fields
  market_type?: "ALPHA" | "SPOT";
  trade_style?: "SCALP" | "SWING";
  rs_vs_btc?: number;
  bid_ask_ratio?: number;
  rsi_val?: number;
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
  bid_ask_ratio?: number | null;
  scans_seen?: number;
  step_up_count?: number;
  is_live_watch?: boolean;
  positives?: string[];
  warnings?: string[];
  exchange_walls?: ExchangeWallItem[];
  last_seen?: string;
  last_seen_at?: string;
}

// NAYA: Stats breakdown interfaces (Telegram /stats & 7D Granular Win-Rate mapping)
export interface PatternStatItem {
  structure: string;
  count: number;
  avg_confidence?: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate_pct: number;
}

export interface TimeframeStatItem {
  timeframe: string;
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate_pct: number;
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
  bid_usd?: number;
  ask_usd?: number;
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
  bid_ask_ratio?: number | null;
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

let serverClockOffsetMs = 0;

/**
 * Parse an ISO-8601 timestamp strictly as UTC even if PostgreSQL/Python serialized
 * a timezone-naive UTC datetime without a trailing "Z" or "+00:00".
 */
export function parseUtcTimestampMs(isoDate: string | undefined | null): number {
  if (!isoDate) return NaN;
  const trimmed = isoDate.trim();
  if (!trimmed) return NaN;
  const hasExplicitZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = hasExplicitZone
    ? trimmed
    : `${trimmed.replace(" ", "T")}Z`;
  return new Date(normalized).getTime();
}

/**
 * Synchronize client clock offset with backend UTC server time (or latest signal/wall timestamp)
 * so relative ages ("14m ago", "2h ago") are 100% accurate even when the user's PC clock is out of sync.
 */
export function syncServerClock(
  serverIso?: string | null,
  items?: Array<{ detected_at?: string; last_seen?: string }>
): void {
  const localNow = Date.now();
  if (serverIso) {
    const serverMs = parseUtcTimestampMs(serverIso);
    if (!isNaN(serverMs) && serverMs > 0) {
      serverClockOffsetMs = serverMs - localNow;
      return;
    }
  }
  if (Array.isArray(items) && items.length > 0) {
    let maxItemMs = 0;
    for (const item of items) {
      const ts = parseUtcTimestampMs(item.detected_at || item.last_seen);
      if (!isNaN(ts) && ts > maxItemMs) {
        maxItemMs = ts;
      }
    }
    if (maxItemMs > localNow + serverClockOffsetMs) {
      serverClockOffsetMs = maxItemMs - localNow;
    }
  }
}

export function getSyncedNowMs(): number {
  return Date.now() + serverClockOffsetMs;
}

export function formatRelativeTime(
  isoDate: string | undefined,
  referenceNowMs?: number
): string {
  if (!isoDate) return "Just now";
  const dateMs = parseUtcTimestampMs(isoDate);
  if (isNaN(dateMs)) return "Just now";
  const syncedNow = getSyncedNowMs();
  const effectiveNow =
    referenceNowMs && referenceNowMs > 0
      ? Math.max(referenceNowMs, syncedNow)
      : syncedNow;
  const diffSeconds = Math.max(0, Math.floor((effectiveNow - dateMs) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
