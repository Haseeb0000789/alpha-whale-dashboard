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

interface DashboardSocketState {
  signals: Signal[];
  stats: SignalStats | null;
  walls: BidWall[];
  isConnected: boolean;
  isInitialLoading: boolean;
  lastUpdated: string | null;
  triggerRefresh: () => void;
}

const DashboardSocketContext = createContext<DashboardSocketState>({
  signals: [],
  stats: null,
  walls: [],
  isConnected: false,
  isInitialLoading: true,
  lastUpdated: null,
  triggerRefresh: () => {},
});

export const useDashboardSocket = () => useContext(DashboardSocketContext);

function resolveApiBase(): string {
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
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [walls, setWalls] = useState<BidWall[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, startTransition] = useTransition();

  // --- AUDIO ALARM SETUP (Safari & Mobile Fix) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevSignalsCountRef = useRef(0);

  useEffect(() => {
    // Jab user pehli dafa screen par click/touch kare, toh audio unlock ho jaye
    const unlockAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
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

  const fetchInitialHttpSnapshot = useCallback(async () => {
    const apiBase = resolveApiBase();
    try {
      const [sigRes, statsRes, wallsRes] = await Promise.all([
        fetch(`${apiBase}/api/signals`, { cache: "no-store" }),
        fetch(`${apiBase}/api/signals/stats`, { cache: "no-store" }),
        fetch(`${apiBase}/api/walls/active`, { cache: "no-store" }),
      ]);
      if (!sigRes.ok || !statsRes.ok || !wallsRes.ok) return;

      const [sigData, statsData, wallsData] = await Promise.all([
        sigRes.json(),
        statsRes.json(),
        wallsRes.json(),
      ]);

      startTransition(() => {
        const parsedSignals = Array.isArray(sigData) ? sigData : sigData.signals || [];
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
          
          // Agar explicit NEW_SIGNAL event aaye
          if (payload.type === "NEW_SIGNAL") {
            playAlarm();
            setSignals((prev) => [payload.data, ...prev]);
            return;
          }

          // Agar snapshot aaye
          if (payload.type === "snapshot") {
            if (Array.isArray(payload.signals)) {
              // Check karein ke kya naya signal aaya hai (Length compare karke)
              if (prevSignalsCountRef.current > 0 && payload.signals.length > prevSignalsCountRef.current) {
                playAlarm();
              }
              prevSignalsCountRef.current = payload.signals.length;
            }

            startTransition(() => {
              if (Array.isArray(payload.signals)) setSignals(payload.signals);
              if (payload.stats) setStats(payload.stats);
              if (Array.isArray(payload.walls)) setWalls(payload.walls);
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

  return (
    <DashboardSocketContext.Provider
      value={{
        signals,
        stats,
        walls,
        isConnected,
        isInitialLoading,
        lastUpdated,
        triggerRefresh,
      }}
    >
      {children}
    </DashboardSocketContext.Provider>
  );
}