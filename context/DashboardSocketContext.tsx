// context/DashboardSocketContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { Signal, SignalStats, BidWall } from "@/types/types";

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
};

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
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

function resolveWsUrl(): string {
  const base = resolveApiBase();
  return base.replace(/^http/, "ws") + "/ws/dashboard";
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, startTransition] = useTransition();

  // --- AUDIO ALARM SETUP (Safari & Mobile Fix) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevSignalsCountRef = useRef(0);
  const prevSpotSignalsCountRef = useRef(0);

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContext =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const playAlarm = useCallback(() => {
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
        setSettings((prev) => ({ ...prev, ...parsed }));
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

      if (setRes.ok) {
        const setJson = await setRes.json();
        setSettings((prev) => {
          const merged = { ...prev, ...setJson };
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
          const parsedSpot = Array.isArray(spotData)
            ? spotData
            : spotData.signals || spotData.spot_signals || [];
          if (Array.isArray(parsedSpot)) {
            prevSpotSignalsCountRef.current = parsedSpot.length;
            setSpotSignals(parsedSpot);
          }
        } catch {
          // Ignore malformed spot payload
        }
      }

      if (!sigRes.ok || !statsRes.ok || !wallsRes.ok) return;

      const [sigData, statsData, wallsData] = await Promise.all([
        sigRes.json(),
        statsRes.json(),
        wallsRes.json(),
      ]);

      startTransition(() => {
        const parsedSignals = Array.isArray(sigData)
          ? sigData
          : sigData.signals || [];
        prevSignalsCountRef.current = parsedSignals.length;
        setSignals(parsedSignals);
        setStats(statsData);
        setWalls(Array.isArray(wallsData) ? wallsData : wallsData.walls || []);
        setIsInitialLoading(false);
      });
    } catch {
      setIsInitialLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const wsUrl = resolveWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Explicit NEW_SIGNAL event (alpha signals only)
          if (payload.type === "NEW_SIGNAL") {
            playAlarm();
            setSignals((prev) => [payload.data, ...prev]);
            prevSignalsCountRef.current += 1;
            return;
          }

          // Explicit NEW_SPOT_SIGNAL event (optional, if backend sends it)
          if (payload.type === "NEW_SPOT_SIGNAL") {
            playAlarm();
            setSpotSignals((prev) => [payload.data, ...prev]);
            prevSpotSignalsCountRef.current += 1;
            return;
          }

          if (payload.type === "snapshot") {
            // Alpha signals length check
            if (Array.isArray(payload.signals)) {
              if (
                prevSignalsCountRef.current > 0 &&
                payload.signals.length > prevSignalsCountRef.current
              ) {
                playAlarm();
              }
              prevSignalsCountRef.current = payload.signals.length;
            }

            // Spot signals length check (separate ref so counter is clean)
            if (Array.isArray(payload.spot_signals)) {
              if (
                prevSpotSignalsCountRef.current > 0 &&
                payload.spot_signals.length > prevSpotSignalsCountRef.current
              ) {
                playAlarm();
              }
              prevSpotSignalsCountRef.current = payload.spot_signals.length;
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
                  const merged = { ...prev, ...payload.settings };
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
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    }
  }, [playAlarm]);

  useEffect(() => {
    fetchInitialHttpSnapshot();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
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

  return (
    <DashboardSocketContext.Provider
      value={{
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
      }}
    >
      {children}
    </DashboardSocketContext.Provider>
  );
}