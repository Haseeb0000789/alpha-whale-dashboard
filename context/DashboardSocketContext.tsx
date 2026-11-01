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

  // Instant HTTP fallback if WebSocket is still handshaking
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
        setSignals(Array.isArray(sigData) ? sigData : sigData.signals || []);
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
          if (payload.type === "snapshot") {
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
  }, []);

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