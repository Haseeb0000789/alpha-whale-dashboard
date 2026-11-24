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
  "horizontal_resistance",
  "vwap_ema_pullback",
  "liquidity_sweep_breakout",
  "order_block_bounce",
  "institutional_reaccumulation",
];

export type AuthRole = "admin" | "vip" | null;

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
      ? merged.enabled_timeframes.map((tf) => String(tf).trim().toLowerCase())
      : [...ALL_TIMEFRAMES],
    enabled_patterns: Array.isArray(merged.enabled_patterns)
      ? merged.enabled_patterns.map((p) => String(p).trim().toLowerCase())
      : [...ALL_PATTERNS],
  };
}

function isSignalStrategyEnabled(sig: Signal, cfg: BotSettings): boolean {
  const tf = String(sig.timeframe || "").trim().toLowerCase();
  const pat = String(sig.structure || "").trim().toLowerCase();
  const enabledTfs = Array.isArray(cfg.enabled_timeframes)
    ? cfg.enabled_timeframes.map((t) => String(t).trim().toLowerCase())
    : ALL_TIMEFRAMES;
  const enabledPats = Array.isArray(cfg.enabled_patterns)
    ? cfg.enabled_patterns.map((p) => String(p).trim().toLowerCase())
    : ALL_PATTERNS;
  return enabledTfs.includes(tf) && enabledPats.includes(pat);
}

function mergeSignalStream(
  prev: Signal[],
  incoming: Signal[],
  cfg: BotSettings,
  preserveOnTransientEmpty: boolean
): Signal[] {
  const filteredIncoming = incoming.filter((s) =>
    isSignalStrategyEnabled(s, cfg)
  );
  if (
    preserveOnTransientEmpty &&
    filteredIncoming.length === 0 &&
    prev.length > 0 &&
    cfg.enabled_timeframes.length > 0 &&
    cfg.enabled_patterns.length > 0
  ) {
    return prev.filter((s) => isSignalStrategyEnabled(s, cfg));
  }

  const prevBySymTf = new Map<string, Signal>();
  for (const p of prev) {
    const k = `${(p.symbol || "").trim().toUpperCase()}:${(
      p.timeframe || ""
    )
      .trim()
      .toLowerCase()}`;
    prevBySymTf.set(k, p);
  }

  const seen = new Set<string>();
  const merged: Signal[] = [];
  for (const item of filteredIncoming) {
    const symTfKey = `${(item.symbol || "").trim().toUpperCase()}:${(
      item.timeframe || ""
    )
      .trim()
      .toLowerCase()}`;
    const dedupKey = preserveOnTransientEmpty
      ? symTfKey
      : item.id !== undefined && item.id !== null
      ? `id:${item.id}`
      : `${symTfKey}:${item.detected_at || ""}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const existing = prevBySymTf.get(symTfKey);
    if (existing && preserveOnTransientEmpty) {
      merged.push({
        ...existing,
        ...item,
        id: existing.id ?? item.id,
        detected_at: existing.detected_at || item.detected_at,
      });
    } else {
      merged.push(item);
    }
  }
  return merged;
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
  accessKey: string;
  authRole: AuthRole;
  verifyAccessKey: (key: string) => Promise<AuthRole>;
  logoutAccess: () => void;
  triggerRefresh: () => void;
  saveBotSettings: (newSettings: BotSettings) => Promise<boolean>;
  resetTelemetryData: () => Promise<boolean>;
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
  accessKey: "",
  authRole: null,
  verifyAccessKey: async () => null,
  logoutAccess: () => {},
  triggerRefresh: () => {},
  saveBotSettings: async () => false,
  resetTelemetryData: async () => false,
});

export const useDashboardSocket = () => useContext(DashboardSocketContext);

const LOCAL_STORAGE_SETTINGS_KEY = "alpha_whale_bot_settings_v5";
const LOCAL_STORAGE_AUTH_KEY = "alpha_whale_auth_v1";

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

function resolveWsUrl(token?: string): string {
  const base = resolveApiBase().replace(/^http/, "ws") + "/ws/dashboard";
  const clean = (token || "").trim();
  return clean ? `${base}?token=${encodeURIComponent(clean)}` : base;
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
  const [accessKey, setAccessKey] = useState<string>("");
  const [authRole, setAuthRole] = useState<AuthRole>(null);
  const [authHydrated, setAuthHydrated] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const settingsRef = useRef<BotSettings>(DEFAULT_SETTINGS);
  const accessKeyRef = useRef<string>("");
  const authRoleRef = useRef<AuthRole>(null);
  const [, startTransition] = useTransition();

  // --- AUDIO ALARM SETUP (Safari & Mobile Fix + Audio Toggle & 75+ Score Gate) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const knownAlphaKeysRef = useRef<Set<string>>(new Set());
  const knownSpotKeysRef = useRef<Set<string>>(new Set());
  const hasSeededAlphaRef = useRef<boolean>(false);
  const hasSeededSpotRef = useRef<boolean>(false);
  const lastSpotFallbackFetchRef = useRef<number>(0);
  const reconnectFnRef = useRef<() => void>(() => {});

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    accessKeyRef.current = accessKey;
    authRoleRef.current = authRole;
  }, [accessKey, authRole]);

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
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          gainNode.disconnect();
        } catch {}
      };

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    }
  }, []);

  // 1. Load cached settings & saved VIP/Admin auth state from localStorage on client mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => {
          const merged = normalizeBotSettings(parsed, prev);
          settingsRef.current = merged;
          return merged;
        });
      }
    } catch {}

    try {
      const savedAuth = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
      if (savedAuth) {
        const parsedAuth = JSON.parse(savedAuth);
        const k = typeof parsedAuth?.key === "string" ? parsedAuth.key.trim() : "";
        const r: AuthRole =
          parsedAuth?.role === "admin" || parsedAuth?.role === "vip"
            ? parsedAuth.role
            : null;
        if (k && r) {
          accessKeyRef.current = k;
          authRoleRef.current = r;
          setAccessKey(k);
          setAuthRole(r);
        }
      }
    } catch {}

    setAuthHydrated(true);
  }, []);

  // 2. Fetch initial HTTP snapshot (public stats/settings + VIP-gated signals/walls when authorized)
  const fetchInitialHttpSnapshot = useCallback(async (keyOverride?: string) => {
    const apiBase = resolveApiBase();
    const activeKey = (
      keyOverride !== undefined ? keyOverride : accessKeyRef.current
    ).trim();
    const authHeaders: HeadersInit | undefined = activeKey
      ? { "X-Access-Key": activeKey }
      : undefined;

    try {
      const statsPromise = fetch(`${apiBase}/api/signals/stats`, {
        cache: "no-store",
      });
      const setPromise = fetch(`${apiBase}/api/settings`, {
        cache: "no-store",
      });

      const sigPromise = activeKey
        ? fetch(`${apiBase}/api/signals`, {
            cache: "no-store",
            headers: authHeaders,
          })
        : Promise.resolve(null);
      const spotPromise = activeKey
        ? fetch(`${apiBase}/api/signals/spot`, {
            cache: "no-store",
            headers: authHeaders,
          })
        : Promise.resolve(null);
      const wallsPromise = activeKey
        ? fetch(`${apiBase}/api/walls/active`, {
            cache: "no-store",
            headers: authHeaders,
          })
        : Promise.resolve(null);

      const [sigRes, spotRes, statsRes, wallsRes, setRes] = await Promise.all([
        sigPromise,
        spotPromise,
        statsPromise,
        wallsPromise,
        setPromise,
      ]);

      if (!isMountedRef.current) return;

      if (setRes.ok) {
        const setJson = await setRes.json();
        const merged = normalizeBotSettings(setJson, settingsRef.current);
        settingsRef.current = merged;
        setSettings(merged);
        try {
          localStorage.setItem(
            LOCAL_STORAGE_SETTINGS_KEY,
            JSON.stringify(merged)
          );
        } catch {}
      }

      if (statsRes.ok) {
        try {
          const statsData = await statsRes.json();
          const serverDateHeader = statsRes.headers.get("date");
          syncServerClock(serverDateHeader);
          if (isMountedRef.current) {
            setStats(statsData);
          }
        } catch {}
      }

      if (spotRes && spotRes.ok) {
        try {
          const spotData = await spotRes.json();
          const parsedSpot: Signal[] = Array.isArray(spotData)
            ? spotData
            : spotData.signals || spotData.spot_signals || [];
          if (Array.isArray(parsedSpot) && isMountedRef.current) {
            for (const s of parsedSpot) {
              knownSpotKeysRef.current.add(signalIdentityKey(s));
            }
            hasSeededSpotRef.current = true;
            setSpotSignals((prev) =>
              mergeSignalStream(prev, parsedSpot, settingsRef.current, true)
            );
          }
        } catch {}
      }

      if (sigRes && sigRes.ok) {
        try {
          const sigData = await sigRes.json();
          const parsedSignals: Signal[] = Array.isArray(sigData)
            ? sigData
            : sigData.signals || [];
          const serverDateHeader = sigRes.headers.get("date");
          syncServerClock(serverDateHeader, parsedSignals);
          knownAlphaKeysRef.current = new Set(
            parsedSignals.map(signalIdentityKey)
          );
          hasSeededAlphaRef.current = true;
          if (isMountedRef.current) {
            setSignals((prev) =>
              mergeSignalStream(prev, parsedSignals, settingsRef.current, false)
            );
          }
        } catch {}
      }

      if (wallsRes && wallsRes.ok) {
        try {
          const wallsData = await wallsRes.json();
          if (isMountedRef.current) {
            setWalls(
              Array.isArray(wallsData) ? wallsData : wallsData.walls || []
            );
          }
        } catch {}
      }

      if (isMountedRef.current) {
        setIsInitialLoading(false);
      }
    } catch {
      if (isMountedRef.current) {
        setIsInitialLoading(false);
      }
    }
  }, []);

  const connectWebSocket = useCallback(
    (keyOverride?: string) => {
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
        const activeKey =
          keyOverride !== undefined ? keyOverride : accessKeyRef.current;
        const wsUrl = resolveWsUrl(activeKey);
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
              if (!isSignalStrategyEnabled(incoming, settingsRef.current))
                return;
              knownAlphaKeysRef.current.add(signalIdentityKey(incoming));
              hasSeededAlphaRef.current = true;
              playAlarm(incoming.confidence);
              setSignals((prev) =>
                mergeSignalStream(
                  prev,
                  [incoming, ...prev],
                  settingsRef.current,
                  false
                )
              );
              return;
            }

            // Explicit NEW_SPOT_SIGNAL event
            if (payload.type === "NEW_SPOT_SIGNAL" && payload.data) {
              const incoming: Signal = payload.data;
              if (!isSignalStrategyEnabled(incoming, settingsRef.current))
                return;
              knownSpotKeysRef.current.add(signalIdentityKey(incoming));
              hasSeededSpotRef.current = true;
              playAlarm(incoming.confidence);
              setSpotSignals((prev) =>
                mergeSignalStream(
                  prev,
                  [incoming, ...prev],
                  settingsRef.current,
                  true
                )
              );
              return;
            }

            if (payload.type === "snapshot") {
              let activeCfg = settingsRef.current;
              if (payload.settings) {
                activeCfg = normalizeBotSettings(payload.settings, activeCfg);
                settingsRef.current = activeCfg;
              }

              syncServerClock(
                payload.timestamp,
                Array.isArray(payload.signals) ? payload.signals : undefined
              );

              if (Array.isArray(payload.signals)) {
                const incomingAlpha: Signal[] = payload.signals.filter(
                  (s: Signal) => isSignalStrategyEnabled(s, activeCfg)
                );
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

              if (Array.isArray(payload.spot_signals)) {
                const incomingSpot: Signal[] = payload.spot_signals.filter(
                  (s: Signal) => isSignalStrategyEnabled(s, activeCfg)
                );
                if (incomingSpot.length > 0) {
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
                  for (const s of incomingSpot) {
                    knownSpotKeysRef.current.add(signalIdentityKey(s));
                  }
                  hasSeededSpotRef.current = true;
                } else if (
                  accessKeyRef.current &&
                  Date.now() - lastSpotFallbackFetchRef.current > 15000 &&
                  activeCfg.enabled_timeframes.length > 0 &&
                  activeCfg.enabled_patterns.length > 0
                ) {
                  lastSpotFallbackFetchRef.current = Date.now();
                  const apiBase = resolveApiBase();
                  fetch(`${apiBase}/api/signals/spot`, {
                    cache: "no-store",
                    headers: { "X-Access-Key": accessKeyRef.current },
                  })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((spotJson) => {
                      if (!spotJson || !isMountedRef.current) return;
                      const parsed: Signal[] = Array.isArray(spotJson)
                        ? spotJson
                        : spotJson.signals || spotJson.spot_signals || [];
                      if (parsed.length > 0) {
                        setSpotSignals((prev) =>
                          mergeSignalStream(
                            prev,
                            parsed,
                            settingsRef.current,
                            true
                          )
                        );
                      }
                    })
                    .catch(() => {});
                }
              }

              startTransition(() => {
                if (payload.settings) {
                  setSettings(activeCfg);
                  try {
                    localStorage.setItem(
                      LOCAL_STORAGE_SETTINGS_KEY,
                      JSON.stringify(activeCfg)
                    );
                  } catch {}
                }
                if (Array.isArray(payload.signals)) {
                  setSignals((prev) =>
                    mergeSignalStream(prev, payload.signals, activeCfg, false)
                  );
                }
                if (Array.isArray(payload.spot_signals)) {
                  const isResetSnapshot =
                    payload.spot_signals.length === 0 &&
                    Array.isArray(payload.signals) &&
                    payload.signals.length === 0 &&
                    payload.stats?.total_signals === 0;
                  if (isResetSnapshot || !accessKeyRef.current) {
                    knownSpotKeysRef.current.clear();
                    setSpotSignals([]);
                  } else {
                    setSpotSignals((prev) =>
                      mergeSignalStream(
                        prev,
                        payload.spot_signals,
                        activeCfg,
                        true
                      )
                    );
                  }
                }
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
    },
    [playAlarm]
  );

  useEffect(() => {
    reconnectFnRef.current = () => connectWebSocket(accessKeyRef.current);
  }, [connectWebSocket]);

  useEffect(() => {
    if (!authHydrated) return;
    isMountedRef.current = true;
    fetchInitialHttpSnapshot(accessKey);
    connectWebSocket(accessKey);

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
  }, [authHydrated, accessKey, connectWebSocket, fetchInitialHttpSnapshot]);

  const verifyAccessKey = useCallback(
    async (candidateKey: string): Promise<AuthRole> => {
      const clean = (candidateKey || "").trim();
      if (!clean) return null;

      const apiBase = resolveApiBase();
      try {
        const res = await fetch(`${apiBase}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: clean }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const role: AuthRole =
          data?.valid && (data?.role === "admin" || data?.role === "vip")
            ? data.role
            : null;
        if (!role) return null;

        accessKeyRef.current = clean;
        authRoleRef.current = role;
        setAccessKey(clean);
        setAuthRole(role);
        try {
          localStorage.setItem(
            LOCAL_STORAGE_AUTH_KEY,
            JSON.stringify({ key: clean, role })
          );
        } catch {}

        return role;
      } catch {
        return null;
      }
    },
    []
  );

  const logoutAccess = useCallback(() => {
    accessKeyRef.current = "";
    authRoleRef.current = null;
    setAccessKey("");
    setAuthRole(null);
    knownAlphaKeysRef.current.clear();
    knownSpotKeysRef.current.clear();
    setSignals([]);
    setSpotSignals([]);
    setWalls([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
    } catch {}
  }, []);

  const triggerRefresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send("refresh");
    } else {
      fetchInitialHttpSnapshot(accessKeyRef.current);
    }
  }, [fetchInitialHttpSnapshot]);

  // 3. Instant Optimistic Save + Backend Persistence (Requires Admin Key)
  const saveBotSettings = useCallback(
    async (newSettings: BotSettings): Promise<boolean> => {
      const normalized = normalizeBotSettings(newSettings, settingsRef.current);
      settingsRef.current = normalized;
      setSettings(normalized);
      setSignals((prev) =>
        prev.filter((s) => isSignalStrategyEnabled(s, normalized))
      );
      setSpotSignals((prev) =>
        prev.filter((s) => isSignalStrategyEnabled(s, normalized))
      );
      try {
        localStorage.setItem(
          LOCAL_STORAGE_SETTINGS_KEY,
          JSON.stringify(normalized)
        );
      } catch {}

      const apiBase = resolveApiBase();
      const adminKey = accessKeyRef.current;
      try {
        const res = await fetch(`${apiBase}/api/settings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(adminKey
              ? { "X-Admin-Key": adminKey, "X-Access-Key": adminKey }
              : {}),
          },
          body: JSON.stringify(normalized),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.settings) {
          const synced = normalizeBotSettings(data.settings, normalized);
          settingsRef.current = synced;
          setSettings(synced);
          try {
            localStorage.setItem(
              LOCAL_STORAGE_SETTINGS_KEY,
              JSON.stringify(synced)
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

  const resetTelemetryData = useCallback(async (): Promise<boolean> => {
    const apiBase = resolveApiBase();
    const adminKey = accessKeyRef.current;
    try {
      const res = await fetch(`${apiBase}/api/settings/reset-telemetry`, {
        method: "POST",
        headers: adminKey
          ? { "X-Admin-Key": adminKey, "X-Access-Key": adminKey }
          : undefined,
      });
      if (!res.ok) return false;

      knownAlphaKeysRef.current.clear();
      knownSpotKeysRef.current.clear();
      lastSpotFallbackFetchRef.current = Date.now();
      setSignals([]);
      setSpotSignals([]);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total_signals: 0,
              finalized: 0,
              win_rate_pct: 0,
              tp1_rate_pct: 0,
              tp2_rate_pct: 0,
              breakeven_rate_pct: 0,
              sl_rate_pct: 0,
              wall_backed_win_rate_pct: 0,
              avg_max_gain_pct: 0,
              avg_max_drawdown_pct: 0,
              by_structure: [],
              by_timeframe: [],
            }
          : null
      );

      triggerRefresh();
      await fetchInitialHttpSnapshot(adminKey);
      return true;
    } catch {
      return false;
    }
  }, [fetchInitialHttpSnapshot, triggerRefresh]);

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
      accessKey,
      authRole,
      verifyAccessKey,
      logoutAccess,
      triggerRefresh,
      saveBotSettings,
      resetTelemetryData,
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
      accessKey,
      authRole,
      verifyAccessKey,
      logoutAccess,
      triggerRefresh,
      saveBotSettings,
      resetTelemetryData,
    ]
  );

  return (
    <DashboardSocketContext.Provider value={contextValue}>
      {children}
    </DashboardSocketContext.Provider>
  );
}
