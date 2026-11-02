// context/DashboardSocketContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { Signal, SignalStats, BidWall, syncServerClock } from "@/types/types";

export const ALL_TIMEFRAMES = ["15m", "1h", "4h", "1d"];

export const ALL_PATTERNS = [
  "double_bottom",
  "cup_and_handle",
  "inverse_head_shoulders",
  "ascending_triangle",
  "bullish_pennant",
  "bullish_flag",
  "descending_trendline",
  "vwap_ema_pullback",
  "liquidity_sweep_breakout",
  "order_block_bounce",
  "institutional_reaccumulation",
];

export interface BotSettings {
  min_score: number;
  min_wall_usd: number;
  proximity_pct: number;
  enable_dead_cat: boolean;
  enable_smc: boolean;
  enable_extension_penalty: boolean;
  enable_audio: boolean;
  cooldown_minutes: number;
  max_alerts_per_cycle: number;
  enabled_timeframes: string[];
  enabled_patterns: string[];
}

export const DEFAULT_SETTINGS: BotSettings = {
  min_score: 65,
  min_wall_usd: 5000,
  proximity_pct: 1.5,
  enable_dead_cat: true,
  enable_smc: true,
  enable_extension_penalty: true,
  enable_audio: true,
  cooldown_minutes: 30,
  max_alerts_per_cycle: 5,
  enabled_timeframes: [...ALL_TIMEFRAMES],
  enabled_patterns: [...ALL_PATTERNS],
};

function normalizeBotSettings(
  raw: Partial<BotSettings> | null | undefined,
  fallback: BotSettings
): BotSettings {
  const merged = { ...fallback, ...(raw ?? {}) };
  return {
    ...merged,
    enabled_timeframes: Array.isArray(merged.enabled_timeframes)
      ? merged.enabled_timeframes
      : [...ALL_TIMEFRAMES],
    enabled_patterns: Array.isArray(merged.enabled_patterns)
      ? merged.enabled_patterns
      : [...ALL_PATTERNS],
  };
}

interface DashboardSocketState {
  signals: Signal[];
  spotSignals: Signal[];
  stats: SignalStats | null;
  walls: BidWall[];
  settings: BotSettings;
  isConnected: boolean;
  isInitialLoading: boolean;
  lastUpdated: string | null;
  triggerRefresh: () => void;
  saveBotSettings: (newSettings: BotSettings) => Promise<boolean>;
}

const DashboardSocketContext = createContext<DashboardSocketState>({
  signals: [],
  spotSignals: [],
  stats: null,
  walls: [],
  settings: DEFAULT_SETTINGS,
  isConnected: false,
  isInitialLoading: true,
  lastUpdated: null,
  triggerRefresh: () => {},
  saveBotSettings: async () => false,
});

export const useDashboardSocket = () => useContext(DashboardSocketContext);

const LOCAL_STORAGE_SETTINGS_KEY = "alpha_whale_bot_settings_v5";

export function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "https:" : "http:";
    return `${proto}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

function resolveWsUrl(): string {
  const base = resolveApiBase();
  return base.replace(/^http/, "ws") + "/ws/dashboard";
}

function signalIdentityKey(sig: Signal): string {
  if (sig.id !== undefined && sig.id !== null) {
    return `id:${sig.id}`;
  }
  return `${(sig.symbol || "").trim().toUpperCase()}:${sig.timeframe || ""}:${sig.detected_at || ""}`;
}

export function DashboardSocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [spotSignals, setSpotSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [walls, setWalls] = useState<BidWall[]>([]);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const settingsRef = useRef<BotSettings>(DEFAULT_SETTINGS);
  const [, startTransition] = useTransition();

  // --- AUDIO ALARM SETUP (Safari & Mobile Fix + Audio Toggle & 75+ Score Gate) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const knownAlphaKeysRef = useRef<Set<string>>(new Set());
  const knownSpotKeysRef = useRef<Set<string>>(new Set());
  const hasSeededAlphaRef = useRef<boolean>(false);
  const hasSeededSpotRef = useRef<boolean>(false);
  const reconnectFnRef = useRef<() => void>(() => {});

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioContextCtor) {
          audioCtxRef.current = new AudioContextCtor();
        }
      }
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const playAlarm = useCallback((signalScore?: number) => {
    if (!settingsRef.current.enable_audio) return;
    if (signalScore !== undefined && signalScore < 75) return;

    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz beep

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          gainNode.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      };

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    }
  }, []);
  // ------------------------------------------------

  // 1. Load cached settings from localStorage immediately on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => {
          const merged = normalizeBotSettings(parsed, prev);
          settingsRef.current = merged;
          return merged;
        });
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // 2. Fetch initial HTTP snapshot (alpha + spot signals) + saved backend settings
  const fetchInitialHttpSnapshot = useCallback(async () => {
    const apiBase = resolveApiBase();
    try {
      const [sigRes, spotRes, statsRes, wallsRes, setRes] = await Promise.all([
        fetch(`${apiBase}/api/signals`, { cache: "no-store" }),
        fetch(`${apiBase}/api/signals/spot`, { cache: "no-store" }),
        fetch(`${apiBase}/api/signals/stats`, { cache: "no-store" }),
        fetch(`${apiBase}/api/walls/active`, { cache: "no-store" }),
        fetch(`${apiBase}/api/settings`, { cache: "no-store" }),
      ]);

      if (!isMountedRef.current) return;

      if (setRes.ok) {
        const setJson = await setRes.json();
        setSettings((prev) => {
          const merged = normalizeBotSettings(setJson, prev);
          settingsRef.current = merged;
          try {
            localStorage.setItem(
              LOCAL_STORAGE_SETTINGS_KEY,
              JSON.stringify(merged)
            );
          } catch {}
          return merged;
        });
      }

      // Spot signals — independent fetch (endpoint can be temporarily empty)
      if (spotRes.ok) {
        try {
          const spotData = await spotRes.json();
          const parsedSpot: Signal[] = Array.isArray(spotData)
            ? spotData
            : spotData.signals || spotData.spot_signals || [];
          if (Array.isArray(parsedSpot) && isMountedRef.current) {
            knownSpotKeysRef.current = new Set(parsedSpot.map(signalIdentityKey));
            hasSeededSpotRef.current = true;
            setSpotSignals(parsedSpot);
          }
        } catch {
          // Ignore malformed spot payload
        }
      }

      if (!sigRes.ok || !statsRes.ok || !wallsRes.ok) {
        if (isMountedRef.current) setIsInitialLoading(false);
        return;
      }

      const [sigData, statsData, wallsData] = await Promise.all([
        sigRes.json(),
        statsRes.json(),
        wallsRes.json(),
      ]);

      if (!isMountedRef.current) return;

      startTransition(() => {
        const parsedSignals: Signal[] = Array.isArray(sigData)
          ? sigData
          : sigData.signals || [];
        const serverDateHeader = sigRes.headers.get("date");
        syncServerClock(serverDateHeader, parsedSignals);
        knownAlphaKeysRef.current = new Set(parsedSignals.map(signalIdentityKey));
        hasSeededAlphaRef.current = true;
        setSignals(parsedSignals);
        setStats(statsData);
        setWalls(Array.isArray(wallsData) ? wallsData : wallsData.walls || []);
        setIsInitialLoading(false);
      });
    } catch {
      if (isMountedRef.current) {
        setIsInitialLoading(false);
      }
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (typeof window === "undefined" || !isMountedRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    try {
      const wsUrl = resolveWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);

          // Explicit NEW_SIGNAL event (alpha signals only)
          if (payload.type === "NEW_SIGNAL" && payload.data) {
            const incoming: Signal = payload.data;
            knownAlphaKeysRef.current.add(signalIdentityKey(incoming));
            hasSeededAlphaRef.current = true;
            playAlarm(incoming.confidence);
            setSignals((prev) => [incoming, ...prev]);
            return;
          }

          // Explicit NEW_SPOT_SIGNAL event
          if (payload.type === "NEW_SPOT_SIGNAL" && payload.data) {
            const incoming: Signal = payload.data;
            knownSpotKeysRef.current.add(signalIdentityKey(incoming));
            hasSeededSpotRef.current = true;
            playAlarm(incoming.confidence);
            setSpotSignals((prev) => [incoming, ...prev]);
            return;
          }

          if (payload.type === "snapshot") {
            syncServerClock(
              payload.timestamp,
              Array.isArray(payload.signals) ? payload.signals : undefined
            );
            // Check for genuinely new high-score (>=75) Alpha signals
            if (Array.isArray(payload.signals)) {
              const incomingAlpha: Signal[] = payload.signals;
              if (hasSeededAlphaRef.current) {
                let maxNewScore = -1;
                for (const s of incomingAlpha) {
                  const key = signalIdentityKey(s);
                  if (!knownAlphaKeysRef.current.has(key)) {
                    maxNewScore = Math.max(maxNewScore, s.confidence ?? 0);
                  }
                }
                if (maxNewScore >= 75) {
                  playAlarm(maxNewScore);
                }
              }
              knownAlphaKeysRef.current = new Set(
                incomingAlpha.map(signalIdentityKey)
              );
              hasSeededAlphaRef.current = true;
            }

            // Check for genuinely new high-score (>=75) Spot signals
            if (Array.isArray(payload.spot_signals)) {
              const incomingSpot: Signal[] = payload.spot_signals;
              if (hasSeededSpotRef.current) {
                let maxNewSpotScore = -1;
                for (const s of incomingSpot) {
                  const key = signalIdentityKey(s);
                  if (!knownSpotKeysRef.current.has(key)) {
                    maxNewSpotScore = Math.max(
                      maxNewSpotScore,
                      s.confidence ?? 0
                    );
                  }
                }
                if (maxNewSpotScore >= 75) {
                  playAlarm(maxNewSpotScore);
                }
              }
              knownSpotKeysRef.current = new Set(
                incomingSpot.map(signalIdentityKey)
              );
              hasSeededSpotRef.current = true;
            }

            startTransition(() => {
              if (Array.isArray(payload.signals)) setSignals(payload.signals);
              if (Array.isArray(payload.spot_signals))
                setSpotSignals(payload.spot_signals);
              if (payload.stats) setStats(payload.stats);
              if (Array.isArray(payload.walls)) setWalls(payload.walls);

              // Update settings if sent via WebSocket
              if (payload.settings) {
                setSettings((prev) => {
                  const merged = normalizeBotSettings(payload.settings, prev);
                  settingsRef.current = merged;
                  try {
                    localStorage.setItem(
                      LOCAL_STORAGE_SETTINGS_KEY,
                      JSON.stringify(merged)
                    );
                  } catch {}
                  return merged;
                });
              }

              if (payload.timestamp) setLastUpdated(payload.timestamp);
              setIsInitialLoading(false);
            });
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            reconnectFnRef.current();
          }
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            reconnectFnRef.current();
          }
        }, 3000);
      }
    }
  }, [playAlarm]);

  useEffect(() => {
    reconnectFnRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialHttpSnapshot();
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket, fetchInitialHttpSnapshot]);

  const triggerRefresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send("refresh");
    } else {
      fetchInitialHttpSnapshot();
    }
  }, [fetchInitialHttpSnapshot]);

  // 3. Instant Optimistic Save + Backend Persistence
  const saveBotSettings = useCallback(
    async (newSettings: BotSettings): Promise<boolean> => {
      // Update Context & localStorage in 0ms so UI NEVER reverts to 55!
      settingsRef.current = newSettings;
      setSettings(newSettings);
      try {
        localStorage.setItem(
          LOCAL_STORAGE_SETTINGS_KEY,
          JSON.stringify(newSettings)
        );
      } catch {}

      const apiBase = resolveApiBase();
      try {
        const res = await fetch(`${apiBase}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSettings),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.settings) {
          settingsRef.current = data.settings;
          setSettings(data.settings);
          try {
            localStorage.setItem(
              LOCAL_STORAGE_SETTINGS_KEY,
              JSON.stringify(data.settings)
            );
          } catch {}
        }
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const contextValue = useMemo<DashboardSocketState>(
    () => ({
      signals,
      spotSignals,
      stats,
      walls,
      settings,
      isConnected,
      isInitialLoading,
      lastUpdated,
      triggerRefresh,
      saveBotSettings,
    }),
    [
      signals,
      spotSignals,
      stats,
      walls,
      settings,
      isConnected,
      isInitialLoading,
      lastUpdated,
      triggerRefresh,
      saveBotSettings,
    ]
  );

  return (
    <DashboardSocketContext.Provider value={contextValue}>
      {children}
    </DashboardSocketContext.Provider>
  );
}
