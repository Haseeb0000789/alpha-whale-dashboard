// app/settings/page.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  useDashboardSocket,
  resolveApiBase,
  BotSettings,
  ALL_TIMEFRAMES,
  ALL_PATTERNS,
  DEFAULT_ENABLED_TIMEFRAMES,
  DEFAULT_ENABLED_PATTERNS,
} from "@/context/DashboardSocketContext";
import { formatPatternName } from "@/types/types";
import { AdminPinGate } from "@/components/AccessGates";
import {
  Settings,
  Sliders,
  ShieldCheck,
  Bell,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Cpu,
  Volume2,
  Sparkles,
  Filter,
  Clock,
  Layers,
  Database,
  Trash2,
  Loader2,
  KeyRound,
  Copy,
  Ban,
  Zap,
  Crown,
  Check,
} from "lucide-react";

interface VipKeyRecord {
  id: number;
  key_code: string;
  plan_type: "7d_trial" | "30d_monthly" | string;
  label: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
  status: "active" | "expired" | "revoked";
  remaining_hours: number;
}

const SPOT_QUANT_PATTERNS = new Set([
  "vwap_ema_pullback",
  "liquidity_sweep_breakout",
  "order_block_bounce",
  "institutional_reaccumulation",
]);

function BinanceSlider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (nextVal: number) => void;
}) {
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div className="group relative flex h-5 w-full items-center select-none">
      {/* Thin Dark Track */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#2B3139]">
        <div
          className="h-full rounded-l-full bg-[#EAECEF] transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Solid Clean Circle Thumb */}
      <div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-[#474D57] bg-[#EAECEF] transition-transform duration-100 group-hover:scale-110"
        style={{ left: `${pct}%` }}
      />

      {/* Native Accessible Range Input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

function BinanceSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-150 focus:outline-none ${
        checked ? "bg-emerald-500" : "bg-[#2B3139]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ControlCenterContent() {
  const {
    settings,
    accessKey,
    saveBotSettings,
    resetTelemetryData,
    triggerRefresh,
  } = useDashboardSocket();

  // Local form draft overlaid on global WebSocket/localStorage settings
  const [draft, setDraft] = useState<Partial<BotSettings> | null>(null);
  const [localBlacklistOverride, setLocalBlacklistOverride] = useState<
    string[] | null
  >(null);
  const [blacklistInput, setBlacklistInput] = useState<string>("");
  const [isUpdatingBlacklist, setIsUpdatingBlacklist] =
    useState<boolean>(false);

  const blacklistedSymbols = useMemo(() => {
    if (localBlacklistOverride !== null) {
      return localBlacklistOverride;
    }
    return Array.isArray(settings.blacklisted_symbols)
      ? settings.blacklisted_symbols
      : [];
  }, [localBlacklistOverride, settings.blacklisted_symbols]);

  const formData: BotSettings = useMemo(() => {
    const merged = draft ? { ...settings, ...draft } : settings;
    return {
      ...merged,
      telegram_wall_cooldown_minutes: Number(
        merged.telegram_wall_cooldown_minutes ?? 120
      ),
      enabled_timeframes: Array.isArray(merged.enabled_timeframes)
        ? merged.enabled_timeframes
        : [...ALL_TIMEFRAMES],
      enabled_patterns: Array.isArray(merged.enabled_patterns)
        ? merged.enabled_patterns
        : [...ALL_PATTERNS],
      blacklisted_symbols: blacklistedSymbols,
    };
  }, [settings, draft, blacklistedSymbols]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [confirmWipe, setConfirmWipe] = useState<boolean>(false);
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const [wipeBanner, setWipeBanner] = useState<string | null>(null);
  const confirmWipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    variant: "synced" | "local";
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // VIP Key Generator & Subscription Manager state
  const [vipKeys, setVipKeys] = useState<VipKeyRecord[]>([]);
  const [buyerLabel, setBuyerLabel] = useState<string>("");
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] =
    useState<VipKeyRecord | null>(null);

  const showToast = useCallback(
    (message: string, variant: "synced" | "local") => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToast({ message, variant });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 3500);
    },
    []
  );

  useEffect(() => {
    if (!accessKey) return;
    let active = true;
    const apiBase = resolveApiBase();
    fetch(`${apiBase}/api/admin/keys`, {
      cache: "no-store",
      headers: { "X-Admin-Key": accessKey, "X-Access-Key": accessKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        setVipKeys(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [accessKey]);

  const handleGenerateVipKey = async (
    planType: "7d_trial" | "30d_monthly"
  ) => {
    if (isGeneratingKey || !accessKey) return;
    setIsGeneratingKey(true);
    const apiBase = resolveApiBase();
    try {
      const res = await fetch(`${apiBase}/api/admin/keys/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": accessKey,
          "X-Access-Key": accessKey,
        },
        body: JSON.stringify({
          plan_type: planType,
          label: buyerLabel.trim() || null,
        }),
      });
      if (res.ok) {
        const created: VipKeyRecord = await res.json();
        setNewlyGeneratedKey(created);
        setBuyerLabel("");
        setVipKeys((prev) => [created, ...prev]);
        showToast(
          `Generated ${
            planType === "7d_trial" ? "7-Day Trial" : "30-Day Monthly"
          } Key: ${created.key_code}`,
          "synced"
        );
      } else {
        showToast("Failed to generate VIP key — check Admin session.", "local");
      }
    } catch {
      showToast("Backend unreachable while generating VIP key.", "local");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeVipKey = async (keyId: number, keyCode: string) => {
    if (!accessKey) return;
    const apiBase = resolveApiBase();
    try {
      const res = await fetch(`${apiBase}/api/admin/keys/${keyId}/revoke`, {
        method: "POST",
        headers: { "X-Admin-Key": accessKey, "X-Access-Key": accessKey },
      });
      if (res.ok) {
        const updated: VipKeyRecord = await res.json();
        setVipKeys((prev) =>
          prev.map((k) => (k.id === keyId ? updated : k))
        );
        if (newlyGeneratedKey?.id === keyId) {
          setNewlyGeneratedKey(updated);
        }
        showToast(`Revoked VIP Key ${keyCode}`, "synced");
      }
    } catch {
      showToast("Failed to revoke key.", "local");
    }
  };

  const buildWelcomeMessage = (rec: VipKeyRecord) => {
    const planLabel =
      rec.plan_type === "7d_trial"
        ? "7-Day VIP Trial Pass ($5)"
        : "30-Day Monthly VIP Access ($15)";
    const expDate = new Date(rec.expires_at).toUTCString();
    return (
      `🐋 Welcome to Alpha Terminal VIP!\n\n` +
      `🔑 Your VIP Access Key: ${rec.key_code}\n` +
      `📦 Plan: ${planLabel}\n` +
      `⏳ Valid Until: ${expDate}\n\n` +
      `🚀 Unlock Live Signals & L2 Whale Walls here:\n` +
      `https://alpha-whale-dashboard.vercel.app/signals`
    );
  };

  const handleCopyWelcomeMessage = async (rec: VipKeyRecord) => {
    try {
      await navigator.clipboard.writeText(buildWelcomeMessage(rec));
      showToast(
        `Copied ${rec.key_code} & Telegram welcome message!`,
        "synced"
      );
    } catch {
      showToast("Clipboard copy failed.", "local");
    }
  };

  const handleCopyRawKey = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Copied key ${code} to clipboard!`, "synced");
    } catch {
      showToast("Clipboard copy failed.", "local");
    }
  };

  const handleBlacklistAction = async (
    rawSymbol: string,
    action: "add" | "remove"
  ) => {
    const cleanSym = rawSymbol
      .trim()
      .toUpperCase()
      .replace(/\/USDT$/i, "")
      .replace(/\/USDC$/i, "")
      .trim();
    if (!cleanSym || isUpdatingBlacklist) return;

    setIsUpdatingBlacklist(true);
    const optimistic =
      action === "add"
        ? Array.from(new Set([...blacklistedSymbols, cleanSym])).sort()
        : blacklistedSymbols.filter((s) => s !== cleanSym);
    setLocalBlacklistOverride(optimistic);
    if (action === "add") {
      setBlacklistInput("");
    }

    const apiBase = resolveApiBase();
    try {
      const res = await fetch(`${apiBase}/api/dashboard/blacklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": accessKey,
          "X-Access-Key": accessKey,
        },
        body: JSON.stringify({
          symbol: cleanSym,
          action,
          reason:
            action === "add"
              ? "Blacklisted via Control Center UI"
              : "Unblacklisted via Control Center UI",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.blacklisted_symbols)) {
          setLocalBlacklistOverride(data.blacklisted_symbols);
        }
        triggerRefresh();
        showToast(
          action === "add"
            ? `🚫 Added ${cleanSym} to Token Blacklist`
            : `✅ Removed ${cleanSym} from Token Blacklist`,
          "synced"
        );
      } else {
        showToast(
          `Failed to ${action} ${cleanSym} — check Admin session.`,
          "local"
        );
      }
    } catch {
      showToast(
        `Updated ${cleanSym} locally (Backend unreachable).`,
        "local"
      );
    } finally {
      setIsUpdatingBlacklist(false);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (confirmWipeTimerRef.current) {
        clearTimeout(confirmWipeTimerRef.current);
      }
    };
  }, []);

  const handleResetTelemetryClick = async () => {
    if (isWiping) return;

    if (!confirmWipe) {
      setConfirmWipe(true);
      setWipeBanner(null);
      if (confirmWipeTimerRef.current) {
        clearTimeout(confirmWipeTimerRef.current);
      }
      confirmWipeTimerRef.current = setTimeout(() => {
        setConfirmWipe(false);
        confirmWipeTimerRef.current = null;
      }, 5000);
      return;
    }

    if (confirmWipeTimerRef.current) {
      clearTimeout(confirmWipeTimerRef.current);
      confirmWipeTimerRef.current = null;
    }
    setConfirmWipe(false);
    setIsWiping(true);

    const ok = await resetTelemetryData();
    setIsWiping(false);

    if (ok) {
      const successMsg =
        "✅ Database & Spot Registry wiped! Tracking fresh signals from 0.";
      setWipeBanner(successMsg);
      showToast(successMsg, "synced");
    } else {
      showToast(
        "⚠️ Failed to wipe telemetry — check backend connection.",
        "local"
      );
    }
  };

  const updateField = <K extends keyof BotSettings>(
    key: K,
    value: BotSettings[K]
  ) => {
    setDraft((prev) => ({ ...(prev ?? {}), [key]: value }));
  };

  const handleToggleTimeframe = async (tf: string) => {
    const current = formData.enabled_timeframes;
    const isEnabled = current.includes(tf);
    const nextTfs = isEnabled
      ? current.filter((item) => item !== tf)
      : [...current, tf];
    const nextSettings: BotSettings = {
      ...formData,
      enabled_timeframes: nextTfs,
    };
    setDraft((prev) => ({ ...(prev ?? {}), enabled_timeframes: nextTfs }));
    const ok = await saveBotSettings(nextSettings);
    showToast(
      ok
        ? `Timeframe ${tf.toUpperCase()} ${isEnabled ? "disabled" : "enabled"} (${nextTfs.length}/${ALL_TIMEFRAMES.length} active)`
        : `Timeframe ${tf.toUpperCase()} saved locally (Backend offline)`,
      ok ? "synced" : "local"
    );
  };

  const handleTogglePattern = async (pattern: string) => {
    const current = formData.enabled_patterns;
    const isEnabled = current.includes(pattern);
    const nextPatterns = isEnabled
      ? current.filter((item) => item !== pattern)
      : [...current, pattern];
    const nextSettings: BotSettings = {
      ...formData,
      enabled_patterns: nextPatterns,
    };
    setDraft((prev) => ({ ...(prev ?? {}), enabled_patterns: nextPatterns }));
    const ok = await saveBotSettings(nextSettings);
    showToast(
      ok
        ? `${formatPatternName(pattern)} ${isEnabled ? "disabled" : "enabled"} (${nextPatterns.length}/${ALL_PATTERNS.length} active)`
        : `${formatPatternName(pattern)} saved locally (Backend offline)`,
      ok ? "synced" : "local"
    );
  };

  const handleEnableAllStrategies = async () => {
    const nextSettings: BotSettings = {
      ...formData,
      enabled_timeframes: [...ALL_TIMEFRAMES],
      enabled_patterns: [...ALL_PATTERNS],
    };
    setDraft((prev) => ({
      ...(prev ?? {}),
      enabled_timeframes: [...ALL_TIMEFRAMES],
      enabled_patterns: [...ALL_PATTERNS],
    }));
    const ok = await saveBotSettings(nextSettings);
    showToast(
      ok
        ? "All 4 Timeframes & 11 Strategy Patterns enabled and synced."
        : "All Timeframes & Patterns enabled locally (Backend offline).",
      ok ? "synced" : "local"
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = await saveBotSettings(formData);
    setIsSaving(false);
    setDraft(null);

    if (ok) {
      showToast(
        `Settings Saved! Min Score (${formData.min_score}) synced with Scanner & Signals Grid.`,
        "synced"
      );
    } else {
      showToast(
        `Backend unreachable — saved locally on Dashboard (Min Score: ${formData.min_score}).`,
        "local"
      );
    }
  };

  const handleResetDefaults = async () => {
    const recommended: BotSettings = {
      min_score: 68,
      min_wall_usd: 5000,
      max_wall_distance_pct: 1.5,
      proximity_pct: 1.5,
      telegram_wall_alerts_enabled: false,
      telegram_min_wall_usd: 15000,
      telegram_wall_cooldown_minutes: 120,
      enable_dead_cat: true,
      enable_smc: true,
      enable_extension_penalty: true,
      enable_audio: true,
      cooldown_minutes: 30,
      max_alerts_per_cycle: 5,
      enabled_timeframes: [...DEFAULT_ENABLED_TIMEFRAMES],
      enabled_patterns: [...DEFAULT_ENABLED_PATTERNS],
      blacklisted_symbols: blacklistedSymbols,
    };
    setDraft(null);
    const ok = await saveBotSettings(recommended);
    showToast(
      ok
        ? "Restored Recommended Institutional Defaults (Min Score: 68)"
        : "Restored Recommended Defaults locally (Backend offline)",
      ok ? "synced" : "local"
    );
  };

  const wallDistanceVal = Number(
    formData.max_wall_distance_pct ?? formData.proximity_pct ?? 1.5
  );
  const telegramMinWallVal = Number(formData.telegram_min_wall_usd ?? 15000);

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#EAECEF]">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-[#2B3139] bg-[#181A20]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B3139] bg-[#1E2329] text-[#848E9C] transition hover:border-[#474D57] hover:text-[#EAECEF]"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <Settings className="h-4 w-4 text-[#848E9C]" />
                <h1 className="text-base font-bold tracking-tight text-[#EAECEF]">
                  Control Center
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live Sync Active
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#848E9C]">
                Single source of truth for Web Terminal (/signals &amp; /walls), WebSockets &amp; Telegram Bot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2B3139] bg-transparent px-3.5 py-2 text-xs font-semibold text-[#848E9C] transition hover:border-[#474D57] hover:bg-[#1E2329] hover:text-[#EAECEF]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Recommended (68)</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FCD535] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#F0B90B] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 12-Column Grid */}
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 pb-20">
        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          {/* Left Side (7 cols): Sliders & Strategy Filters */}
          <div className="space-y-4 lg:col-span-7">
            {/* Card 1: 4-Pillar & Order Book Thresholds */}
            <section className="rounded-xl border border-[#2B3139] bg-[#181A20] p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-[#2B3139] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#848E9C]" />
                  <h2 className="text-sm font-bold text-[#EAECEF]">
                    4-Pillar &amp; Order Book Thresholds
                  </h2>
                </div>
                <span className="font-mono text-[11px] text-[#848E9C]">
                  QUANT ENGINE
                </span>
              </div>

              {/* 1. Minimum 4-Pillar Signal Score */}
              <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-bold text-[#EAECEF]">
                      Minimum 4-Pillar Signal Score
                    </label>
                    <p className="text-xs text-[#848E9C]">
                      Unified gate for Alpha &amp; Spot signals, Web Radar &amp; Telegram Bot
                    </p>
                  </div>
                  <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-mono text-sm font-bold text-emerald-400">
                    {formData.min_score} / 100
                  </span>
                </div>
                <BinanceSlider
                  min={40}
                  max={90}
                  step={1}
                  value={formData.min_score}
                  onChange={(val) => updateField("min_score", val)}
                />
                <div className="flex justify-between font-mono text-[11px] text-[#848E9C]">
                  <span>40 (Loose)</span>
                  <span>55 (Moderate)</span>
                  <span className="font-semibold text-emerald-400">
                    68 (Recommended)
                  </span>
                  <span>90 (Strict)</span>
                </div>
              </div>

              {/* 2. Web Radar Min Bid Wall Size (USD) */}
              <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-bold text-[#EAECEF]">
                      Web Radar Min Bid Wall Size (USD)
                    </label>
                    <p className="text-xs text-[#848E9C]">
                      Governs Binance L2 Bid Walls on the Web /walls Radar &amp; WebSocket stream
                    </p>
                  </div>
                  <span className="rounded border border-[#2B3139] bg-[#0B0E11] px-2.5 py-1 font-mono text-sm font-bold text-[#EAECEF]">
                    ${formData.min_wall_usd.toLocaleString()}
                  </span>
                </div>
                <BinanceSlider
                  min={2000}
                  max={50000}
                  step={1000}
                  value={formData.min_wall_usd}
                  onChange={(val) => updateField("min_wall_usd", val)}
                />
                <div className="flex justify-between font-mono text-[11px] text-[#848E9C]">
                  <span>$2,000</span>
                  <span className="font-semibold text-emerald-400">
                    $5,000 (Default)
                  </span>
                  <span>$15,000</span>
                  <span>$50,000</span>
                </div>
              </div>

              {/* 3. Max Bid Wall Distance (%) */}
              <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-bold text-[#EAECEF]">
                      Max Bid Wall Distance (%)
                    </label>
                    <p className="text-xs text-[#848E9C]">
                      Filters out bid walls sitting further than this % below current mid-price
                    </p>
                  </div>
                  <span className="rounded border border-[#2B3139] bg-[#0B0E11] px-2.5 py-1 font-mono text-sm font-bold text-[#EAECEF]">
                    -{wallDistanceVal.toFixed(1)}%
                  </span>
                </div>
                <BinanceSlider
                  min={0.3}
                  max={4.0}
                  step={0.1}
                  value={wallDistanceVal}
                  onChange={(val) => {
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      max_wall_distance_pct: val,
                      proximity_pct: val,
                    }));
                  }}
                />
                <div className="flex justify-between font-mono text-[11px] text-[#848E9C]">
                  <span>0.3% (Scalp)</span>
                  <span className="font-semibold text-[#EAECEF]">
                    1.5% (Optimal)
                  </span>
                  <span>4.0% (Wide)</span>
                </div>
              </div>

              {/* 4. Telegram Wall Alerts Toggle & Telegram Min Whale Wall Size (USD) */}
              <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#EAECEF]">
                        Telegram Wall Alerts Toggle
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          formData.telegram_wall_alerts_enabled
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                            : "border-[#2B3139] bg-[#181A20] text-[#848E9C]"
                        }`}
                      >
                        {formData.telegram_wall_alerts_enabled
                          ? "ON (Bundled Digest)"
                          : "OFF (Breakouts Only)"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#848E9C]">
                      Default OFF keeps Telegram clean for breakout signals. When ON, only 85+ Score Binance walls &ge; threshold below are sent as a bundled digest.
                    </p>
                  </div>
                  <BinanceSwitch
                    checked={Boolean(formData.telegram_wall_alerts_enabled)}
                    onCheckedChange={(next) =>
                      updateField("telegram_wall_alerts_enabled", next)
                    }
                  />
                </div>

                <div className="border-t border-[#2B3139] pt-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="text-sm font-bold text-[#EAECEF]">
                        Telegram Min Whale Wall Size (USD)
                      </label>
                      <p className="text-xs text-[#848E9C]">
                        Eliminates $5k micro-wall spam on Telegram (requires Score &ge; 85)
                      </p>
                    </div>
                    <span className="rounded border border-[#2B3139] bg-[#0B0E11] px-2.5 py-1 font-mono text-sm font-bold text-[#EAECEF]">
                      ${telegramMinWallVal.toLocaleString()}
                    </span>
                  </div>
                  <BinanceSlider
                    min={5000}
                    max={100000}
                    step={2500}
                    value={telegramMinWallVal}
                    onChange={(val) =>
                      updateField("telegram_min_wall_usd", val)
                    }
                  />
                  <div className="flex justify-between font-mono text-[11px] text-[#848E9C]">
                    <span>$5,000</span>
                    <span className="font-semibold text-emerald-400">
                      $15,000 (Recommended)
                    </span>
                    <span>$50,000</span>
                    <span>$100,000</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Card 2: Active Strategy Filters (Compact Chips) */}
            <section className="rounded-xl border border-[#2B3139] bg-[#181A20] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2B3139] pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#848E9C]" />
                  <div>
                    <h2 className="text-sm font-bold text-[#EAECEF]">
                      Active Strategy Filters
                    </h2>
                    <p className="text-xs text-[#848E9C]">
                      Disabled timeframes &amp; patterns are skipped by Alpha &amp; Spot scanners, DB, Telegram, and WebSockets
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnableAllStrategies}
                  className="rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-1.5 text-xs font-semibold text-[#EAECEF] transition hover:border-[#474D57] hover:bg-[#2B3139]"
                >
                  Enable All
                </button>
              </div>

              {/* Enabled Timeframes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#848E9C]">
                    <Clock className="h-3.5 w-3.5 text-[#848E9C]" />
                    <span>Enabled Timeframes</span>
                  </span>
                  <span className="font-mono text-xs text-[#848E9C]">
                    {formData.enabled_timeframes.length} / {ALL_TIMEFRAMES.length} Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ALL_TIMEFRAMES.map((tf) => {
                    const checked = formData.enabled_timeframes.includes(tf);
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => handleToggleTimeframe(tf)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${
                          checked
                            ? "border-[#474D57] bg-[#2B3139] text-white"
                            : "border-[#2B3139] bg-transparent text-[#848E9C] hover:border-[#474D57] hover:text-[#EAECEF]"
                        }`}
                      >
                        <span className="font-mono font-bold uppercase">
                          {tf}
                        </span>
                        {checked ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <span className="h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enabled Chart & Quant Patterns (Compact 3-Col Chip Grid) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#848E9C]">
                    <Layers className="h-3.5 w-3.5 text-[#848E9C]" />
                    <span>Enabled Chart &amp; Quant Patterns</span>
                  </span>
                  <span className="font-mono text-xs text-[#848E9C]">
                    {formData.enabled_patterns.length} / {ALL_PATTERNS.length} Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ALL_PATTERNS.map((pattern) => {
                    const checked = formData.enabled_patterns.includes(pattern);
                    const isSpotQuant = SPOT_QUANT_PATTERNS.has(pattern);
                    return (
                      <button
                        key={pattern}
                        type="button"
                        onClick={() => handleTogglePattern(pattern)}
                        className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-left transition ${
                          checked
                            ? "border-[#474D57] bg-[#2B3139] text-white"
                            : "border-[#2B3139] bg-transparent text-[#848E9C] hover:border-[#474D57] hover:text-[#EAECEF]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-xs font-medium">
                            {formatPatternName(pattern)}
                          </span>
                          <span className="shrink-0 rounded border border-[#2B3139] bg-[#181A20] px-1 py-0.2 font-mono text-[9px] uppercase text-[#848E9C]">
                            {isSpotQuant ? "SPOT" : "ALPHA"}
                          </span>
                        </div>
                        {checked && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Right Side (5 cols): Strategy Guards, Alert Pacing, Blacklist, VIP Keys & Reset */}
          <div className="space-y-4 lg:col-span-5">
            {/* Card 3: Strategy Guards & SMC Engine */}
            <section className="rounded-xl border border-[#2B3139] bg-[#181A20] p-5 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-[#2B3139] pb-3">
                <ShieldCheck className="h-4 w-4 text-[#848E9C]" />
                <h2 className="text-sm font-bold text-[#EAECEF]">
                  Strategy Guards &amp; SMC Engine
                </h2>
              </div>

              {/* Guard 1: SMC */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#2B3139] bg-[#1E2329] p-3.5">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#EAECEF]">
                    <Sparkles className="h-3.5 w-3.5 text-[#848E9C]" />
                    <span>Smart Money Concepts (BoS &amp; Order Blocks)</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#848E9C]">
                    Boosts Pillar-3 score when institutional Break of Structure aligns
                  </p>
                </div>
                <BinanceSwitch
                  checked={Boolean(formData.enable_smc)}
                  onCheckedChange={(next) => updateField("enable_smc", next)}
                />
              </div>

              {/* Guard 2: Dead-Cat Bounce Filter */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#2B3139] bg-[#1E2329] p-3.5">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#EAECEF]">
                    <Cpu className="h-3.5 w-3.5 text-[#848E9C]" />
                    <span>Anti-Spoof &amp; Dead-Cat Bounce Filter</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#848E9C]">
                    Penalizes coins with &lt;45% wall respect rate or dumped macro structure
                  </p>
                </div>
                <BinanceSwitch
                  checked={Boolean(formData.enable_dead_cat)}
                  onCheckedChange={(next) =>
                    updateField("enable_dead_cat", next)
                  }
                />
              </div>

              {/* Guard 3: Over-Extension Penalty */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#2B3139] bg-[#1E2329] p-3.5">
                <div className="pr-2">
                  <span className="block text-sm font-bold text-[#EAECEF]">
                    Over-Extension Guard (&gt;5% Above Neckline)
                  </span>
                  <p className="mt-0.5 text-xs text-[#848E9C]">
                    Marks pumped breakouts as &ldquo;Wait for Retest&rdquo; to prevent top-buying
                  </p>
                </div>
                <BinanceSwitch
                  checked={Boolean(formData.enable_extension_penalty)}
                  onCheckedChange={(next) =>
                    updateField("enable_extension_penalty", next)
                  }
                />
              </div>

              {/* Guard 4: Audio Alerts */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#2B3139] bg-[#1E2329] p-3.5">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#EAECEF]">
                    <Volume2 className="h-3.5 w-3.5 text-[#848E9C]" />
                    <span>Terminal Audio Ping on High-Score Signal</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#848E9C]">
                    Plays subtle institutional sonar chime when 75+ signal arrives
                  </p>
                </div>
                <BinanceSwitch
                  checked={Boolean(formData.enable_audio)}
                  onCheckedChange={(next) => updateField("enable_audio", next)}
                />
              </div>
            </section>

            {/* Card 4: Alert Pacing & Cooldowns (Clean Dark Inputs with Inline Unit Suffix) */}
            <section className="rounded-xl border border-[#2B3139] bg-[#181A20] p-5 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-[#2B3139] pb-3">
                <Bell className="h-4 w-4 text-[#848E9C]" />
                <h2 className="text-sm font-bold text-[#EAECEF]">
                  Alert Pacing &amp; Cooldown
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#848E9C]">
                    Re-Alert Cooldown
                  </label>
                  <div className="flex items-center rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 focus-within:border-[#FCD535]">
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={formData.cooldown_minutes}
                      onChange={(e) =>
                        updateField("cooldown_minutes", Number(e.target.value))
                      }
                      className="w-full bg-transparent font-mono text-sm font-bold text-[#EAECEF] focus:outline-none"
                    />
                    <span className="ml-1.5 font-mono text-[10px] font-semibold uppercase text-[#848E9C]">
                      MINS
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#848E9C]">
                    Wall Alert Cooldown
                  </label>
                  <div className="flex items-center rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 focus-within:border-[#FCD535]">
                    <input
                      type="number"
                      min={5}
                      max={720}
                      value={formData.telegram_wall_cooldown_minutes ?? 120}
                      onChange={(e) =>
                        updateField(
                          "telegram_wall_cooldown_minutes",
                          Number(e.target.value)
                        )
                      }
                      className="w-full bg-transparent font-mono text-sm font-bold text-[#EAECEF] focus:outline-none"
                    />
                    <span className="ml-1.5 font-mono text-[10px] font-semibold uppercase text-[#848E9C]">
                      MINS
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#848E9C]">
                    Max Alerts / Cycle
                  </label>
                  <div className="flex items-center rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 focus-within:border-[#FCD535]">
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={formData.max_alerts_per_cycle}
                      onChange={(e) =>
                        updateField(
                          "max_alerts_per_cycle",
                          Number(e.target.value)
                        )
                      }
                      className="w-full bg-transparent font-mono text-sm font-bold text-[#EAECEF] focus:outline-none"
                    />
                    <span className="ml-1.5 font-mono text-[10px] font-semibold uppercase text-[#848E9C]">
                      MAX
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Card 5: Token Blacklist Manager */}
            <section className="rounded-xl border border-[#2B3139] bg-[#181A20] p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#2B3139] pb-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-[#848E9C]" />
                  <div>
                    <h2 className="text-sm font-bold text-[#EAECEF]">
                      Token Blacklist Manager
                    </h2>
                    <p className="text-xs text-[#848E9C]">
                      Block noisy tokens across Alpha, Spot, Live Walls &amp; Telegram
                    </p>
                  </div>
                </div>
                <span className="rounded border border-[#2B3139] bg-[#1E2329] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#848E9C]">
                  {blacklistedSymbols.length} Blocked
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={blacklistInput}
                  onChange={(e) => setBlacklistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBlacklistAction(blacklistInput, "add");
                    }
                  }}
                  placeholder="e.g. DGAI or PEPE"
                  className="flex-1 rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 font-mono text-xs text-[#EAECEF] placeholder-[#848E9C] focus:border-[#FCD535] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isUpdatingBlacklist || !blacklistInput.trim()}
                  onClick={() => handleBlacklistAction(blacklistInput, "add")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2B3139] bg-[#2B3139] px-3.5 py-2 text-xs font-bold text-[#EAECEF] transition hover:bg-[#474D57] disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>Add to Blacklist</span>
                </button>
              </div>

              {blacklistedSymbols.length === 0 ? (
                <div className="rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3.5 py-3 text-center text-xs text-[#848E9C]">
                  No tokens are currently blacklisted.
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {blacklistedSymbols.map((sym) => (
                    <span
                      key={sym}
                      className="inline-flex items-center gap-1.5 rounded border border-[#2B3139] bg-[#1E2329] px-2.5 py-1 font-mono text-xs font-semibold text-[#EAECEF]"
                    >
                      <span>{sym}</span>
                      <button
                        type="button"
                        disabled={isUpdatingBlacklist}
                        onClick={() => handleBlacklistAction(sym, "remove")}
                        title={`Remove ${sym} from Blacklist`}
                        className="text-[#848E9C] transition hover:text-rose-400 disabled:opacity-50"
                      >
                        ✖
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Card 6: VIP Key Generator & Subscriptions */}
            <section className="rounded-xl border border-[#2B3139] bg-[#181A20] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2B3139] pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#FCD535]" />
                  <div>
                    <h2 className="text-sm font-bold text-[#EAECEF]">
                      VIP Key Generator &amp; Subscriptions
                    </h2>
                    <p className="text-xs text-[#848E9C]">
                      Issue auto-expiring 7-Day Trial ($5) or 30-Day Monthly ($15) VIP keys
                    </p>
                  </div>
                </div>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                  {vipKeys.filter((k) => k.status === "active").length} Active
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs text-[#848E9C]">
                  Buyer Name / Telegram @username (Optional)
                </label>
                <input
                  type="text"
                  value={buyerLabel}
                  onChange={(e) => setBuyerLabel(e.target.value)}
                  placeholder="e.g. @ali_trader or Bilal (Easypaisa)"
                  className="w-full rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 text-xs text-[#EAECEF] placeholder-[#848E9C] focus:border-[#FCD535] focus:outline-none"
                />

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isGeneratingKey}
                    onClick={() => handleGenerateVipKey("7d_trial")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs font-bold text-[#EAECEF] transition hover:border-[#474D57] hover:bg-[#2B3139] disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5 text-[#FCD535]" />
                    <span>Generate 7-Day Trial ($5)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingKey}
                    onClick={() => handleGenerateVipKey("30d_monthly")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <Crown className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Generate 30-Day Monthly ($15)</span>
                  </button>
                </div>
              </div>

              {newlyGeneratedKey && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        New Key Ready to Send
                      </span>
                      <span className="font-mono text-sm font-bold text-[#EAECEF]">
                        {newlyGeneratedKey.key_code}
                      </span>
                    </div>
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                      {newlyGeneratedKey.plan_type === "7d_trial"
                        ? "7D Trial ($5)"
                        : "30D Monthly ($15)"}
                    </span>
                  </div>
                  <p className="text-xs text-[#848E9C]">
                    Expires:{" "}
                    <strong className="font-mono text-[#EAECEF]">
                      {new Date(newlyGeneratedKey.expires_at).toLocaleString()}
                    </strong>
                    {newlyGeneratedKey.label
                      ? ` • Buyer: ${newlyGeneratedKey.label}`
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyWelcomeMessage(newlyGeneratedKey)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FCD535] px-3 py-2 text-xs font-bold text-black transition hover:bg-[#F0B90B]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Key &amp; Welcome Message</span>
                  </button>
                </div>
              )}

              {/* Generated Keys List */}
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {vipKeys.length === 0 ? (
                  <p className="py-3 text-center text-xs text-[#848E9C]">
                    No VIP keys generated yet.
                  </p>
                ) : (
                  vipKeys.map((k) => {
                    const statusColor =
                      k.status === "active"
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                        : k.status === "expired"
                        ? "border-[#2B3139] bg-[#181A20] text-[#848E9C]"
                        : "border-rose-900/50 bg-[#2C1414] text-rose-300";

                    const daysLeft = (k.remaining_hours / 24).toFixed(1);

                    return (
                      <div
                        key={k.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2.5 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-[#EAECEF]">
                              {k.key_code}
                            </span>
                            <span className="rounded border border-[#2B3139] bg-[#181A20] px-1.5 py-0.5 font-mono text-[10px] text-[#848E9C]">
                              {k.plan_type === "7d_trial"
                                ? "7D Trial"
                                : "30D Monthly"}
                            </span>
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${statusColor}`}
                            >
                              {k.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#848E9C]">
                            {k.label ? (
                              <span className="font-semibold text-[#EAECEF]">
                                {k.label} •{" "}
                              </span>
                            ) : null}
                            {k.status === "active" ? (
                              <span>
                                {daysLeft}d left (exp{" "}
                                {new Date(k.expires_at).toLocaleDateString()})
                              </span>
                            ) : (
                              <span>
                                Exp {new Date(k.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyWelcomeMessage(k)}
                            title="Copy Key & Telegram Welcome Message"
                            className="inline-flex items-center gap-1 rounded border border-[#2B3139] bg-[#181A20] px-2 py-1 text-[11px] font-semibold text-[#EAECEF] transition hover:border-[#474D57]"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyRawKey(k.key_code)}
                            title="Copy Raw Key Code"
                            className="rounded border border-[#2B3139] bg-[#181A20] px-2 py-1 font-mono text-[10px] text-[#848E9C] transition hover:text-[#EAECEF]"
                          >
                            Key
                          </button>
                          {k.status === "active" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRevokeVipKey(k.id, k.key_code)
                              }
                              title="Revoke Key Immediately"
                              className="inline-flex items-center gap-1 rounded border border-rose-900/50 bg-[#2C1414] px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-950"
                            >
                              <Ban className="h-3 w-3" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Card 7: Destructive Zone (Database Reset) */}
            <section className="rounded-xl border border-rose-900/50 bg-[#2C1414] p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-rose-300" />
                  <div>
                    <h2 className="text-sm font-bold text-rose-100">
                      Telemetry &amp; Database Reset
                    </h2>
                    <p className="text-xs text-rose-200/70">
                      Wipe historical Alpha signals, outcomes &amp; Spot state to evaluate new strategy filters from 0
                    </p>
                  </div>
                </div>
              </div>

              {wipeBanner && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-semibold text-emerald-300">
                  {wipeBanner}
                </div>
              )}

              <button
                type="button"
                onClick={handleResetTelemetryClick}
                disabled={isWiping}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold transition disabled:opacity-60 ${
                  confirmWipe
                    ? "border-[#FCD535] bg-[#FCD535] text-black"
                    : "border-rose-900/50 bg-rose-950/60 text-rose-200 hover:bg-rose-900/60 hover:text-white"
                }`}
              >
                {isWiping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-rose-200" />
                    <span>Wiping Database &amp; Spot Registry...</span>
                  </>
                ) : confirmWipe ? (
                  <span>Click Again to Confirm Full DB Wipe</span>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Reset Telemetry &amp; Start Fresh</span>
                  </>
                )}
              </button>
            </section>
          </div>
        </form>

        {/* Save Confirmation Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border bg-[#181A20] px-4 py-3 text-xs font-semibold shadow-xl ${
                toast.variant === "synced"
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-[#FCD535]/40 text-[#FCD535]"
              }`}
            >
              {toast.variant === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-[#FCD535]" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function ControlCenterPage() {
  return (
    <AdminPinGate>
      <ControlCenterContent />
    </AdminPinGate>
  );
}
