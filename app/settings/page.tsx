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
  Minus,
  Plus,
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

type AccentVariant = "emerald" | "cyan" | "purple" | "amber";

const SLIDER_ACCENT_STYLES: Record<
  AccentVariant,
  {
    trackFill: string;
    trackGlow: string;
    thumb: string;
    badge: string;
  }
> = {
  emerald: {
    trackFill: "bg-emerald-500/25 border-y border-l border-emerald-400/40",
    trackGlow: "bg-gradient-to-r from-emerald-500/40 to-emerald-400",
    thumb:
      "bg-emerald-400 border-2 border-zinc-950 shadow-[0_0_14px_rgba(52,211,153,0.85)]",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.15)]",
  },
  cyan: {
    trackFill: "bg-cyan-500/25 border-y border-l border-cyan-400/40",
    trackGlow: "bg-gradient-to-r from-cyan-500/40 to-cyan-400",
    thumb:
      "bg-cyan-400 border-2 border-zinc-950 shadow-[0_0_14px_rgba(34,211,238,0.85)]",
    badge:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.15)]",
  },
  purple: {
    trackFill: "bg-purple-500/25 border-y border-l border-purple-400/40",
    trackGlow: "bg-gradient-to-r from-purple-500/40 to-purple-400",
    thumb:
      "bg-purple-400 border-2 border-zinc-950 shadow-[0_0_14px_rgba(192,132,252,0.85)]",
    badge:
      "border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-[inset_0_1px_0_0_rgba(192,132,252,0.15)]",
  },
  amber: {
    trackFill: "bg-amber-500/25 border-y border-l border-amber-400/40",
    trackGlow: "bg-gradient-to-r from-amber-500/40 to-amber-400",
    thumb:
      "bg-amber-400 border-2 border-zinc-950 shadow-[0_0_14px_rgba(251,191,36,0.85)]",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.15)]",
  },
};

function AnimatedValueBadge({
  valueKey,
  displayValue,
  accent = "emerald",
}: {
  valueKey: string | number;
  displayValue: string;
  accent?: AccentVariant;
}) {
  const styles = SLIDER_ACCENT_STYLES[accent];
  return (
    <div
      className={`relative inline-flex min-w-[96px] items-center justify-center overflow-hidden rounded-lg border px-3 py-1 font-mono text-sm font-black tracking-tight ${styles.badge}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(valueKey)}
          initial={{ y: -11, opacity: 0, filter: "blur(2px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: 11, opacity: 0, filter: "blur(2px)" }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="inline-block"
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function InstitutionalSlider({
  min,
  max,
  step,
  value,
  onChange,
  accent = "emerald",
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (nextVal: number) => void;
  accent?: AccentVariant;
}) {
  const styles = SLIDER_ACCENT_STYLES[accent];
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div className="group relative flex h-6 w-full items-center select-none">
      {/* Base Track */}
      <div className="relative h-2 w-full overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/90 shadow-inner">
        {/* Glowing Filled Track */}
        <div
          className={`h-full rounded-l-full transition-[width] duration-75 ${styles.trackFill}`}
          style={{ width: `${pct}%` }}
        >
          <div className={`h-full w-full opacity-80 ${styles.trackGlow}`} />
        </div>
      </div>

      {/* Glowing Thumb */}
      <div
        className={`pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full transition-transform duration-100 group-hover:scale-110 group-active:scale-125 ${styles.thumb}`}
        style={{ left: `${pct}%` }}
      />

      {/* Native Accessible Range Input Overlay */}
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

function InstitutionalSwitch({
  checked,
  onCheckedChange,
  accent = "emerald",
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  accent?: "emerald" | "amber";
}) {
  const activeTrack =
    accent === "amber"
      ? "border-amber-500/50 bg-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
      : "border-emerald-500/50 bg-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
  const activeThumb =
    accent === "amber"
      ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
      : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-200 focus:outline-none ${
        checked ? activeTrack : "border-zinc-800 bg-zinc-900/90"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        className={`inline-block h-4 w-4 rounded-full ${
          checked
            ? `translate-x-5 ${activeThumb}`
            : "translate-x-0 bg-zinc-500"
        }`}
      />
    </button>
  );
}

function InstitutionalCounter({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  accentClass = "text-white",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  accentClass?: string;
  onChange: (next: number) => void;
}) {
  const handleStep = (delta: number) => {
    const next = Math.min(max, Math.max(min, Number(value || 0) + delta));
    onChange(next);
  };

  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center justify-between gap-1">
        <label className="text-[11px] font-medium tracking-tight text-zinc-400">
          {label}
        </label>
        {unit && (
          <span className="font-mono text-[10px] uppercase text-zinc-500">
            {unit}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-lg border border-zinc-800/80 bg-[#0B0E14] p-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => handleStep(-step)}
          disabled={value <= min}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800/80 bg-zinc-900/80 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </motion.button>

        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (!Number.isNaN(raw)) {
              onChange(Math.min(max, Math.max(min, raw)));
            }
          }}
          className={`w-16 bg-transparent text-center font-mono text-sm font-black focus:outline-none ${accentClass}`}
        />

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => handleStep(step)}
          disabled={value >= max}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800/80 bg-zinc-900/80 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
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
    <div className="min-h-screen bg-[#0B0E14] text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Sticky Institutional Glassmorphism Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/70 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-white"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Settings className="h-4 w-4 text-emerald-400" />
                <h1 className="text-base font-black tracking-tight text-white sm:text-lg">
                  Bot Control Center
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live Sync Active
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Single source of truth for Web Terminal (/signals &amp; /walls), WebSockets &amp; Telegram Bot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3.5 py-2 font-mono text-xs font-bold text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
              <span>Reset Recommended (68)</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-xs font-black tracking-wide text-zinc-950 shadow-[0_0_24px_rgba(16,185,129,0.3)] transition hover:brightness-110 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Syncing..." : "Save Configuration"}</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 pb-24">
        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          {/* Left Column (7 cols): Core Quantitative Thresholds + Active Strategy Filters */}
          <div className="space-y-6 lg:col-span-7">
            {/* Section 1: 4-Pillar & Order Book Thresholds */}
            <section className="rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/40 to-zinc-950/70 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white">
                      4-Pillar &amp; Order Book Thresholds
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Real-time quantitative execution gates across Alpha, Spot &amp; L2 Order Books
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  QUANT ENGINE v5
                </span>
              </div>

              {/* 1. Minimum 4-Pillar Score Slider */}
              <div className="rounded-xl border border-zinc-800/50 bg-[#080A0F]/80 p-4 space-y-3 transition-colors hover:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-white">
                      Minimum 4-Pillar Signal Score
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Unified gate for Alpha &amp; Spot signals, Web Radar &amp; Telegram Bot
                    </p>
                  </div>
                  <AnimatedValueBadge
                    valueKey={formData.min_score}
                    displayValue={`${formData.min_score} / 100`}
                    accent="cyan"
                  />
                </div>
                <InstitutionalSlider
                  min={40}
                  max={90}
                  step={1}
                  value={formData.min_score}
                  onChange={(val) => updateField("min_score", val)}
                  accent="cyan"
                />
                <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>40 (Loose)</span>
                  <span>55 (Moderate)</span>
                  <span className="font-bold text-emerald-400">
                    68 (Recommended Institutional)
                  </span>
                  <span>90 (Strict)</span>
                </div>
              </div>

              {/* 2. Web Radar Min Bid Wall Size (USD) */}
              <div className="rounded-xl border border-zinc-800/50 bg-[#080A0F]/80 p-4 space-y-3 transition-colors hover:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-white">
                      Web Radar Min Bid Wall Size (USD)
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Governs Binance L2 Bid Walls on the Web /walls Radar &amp; WebSocket stream
                    </p>
                  </div>
                  <AnimatedValueBadge
                    valueKey={formData.min_wall_usd}
                    displayValue={`$${formData.min_wall_usd.toLocaleString()}`}
                    accent="emerald"
                  />
                </div>
                <InstitutionalSlider
                  min={2000}
                  max={50000}
                  step={1000}
                  value={formData.min_wall_usd}
                  onChange={(val) => updateField("min_wall_usd", val)}
                  accent="emerald"
                />
                <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>$2,000</span>
                  <span className="font-bold text-emerald-400">
                    $5,000 (Default)
                  </span>
                  <span>$15,000</span>
                  <span>$50,000</span>
                </div>
              </div>

              {/* 3. Max Bid Wall Distance (%) */}
              <div className="rounded-xl border border-zinc-800/50 bg-[#080A0F]/80 p-4 space-y-3 transition-colors hover:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-white">
                      Max Bid Wall Distance (%)
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Filters out bid walls sitting further than this % below current mid-price
                    </p>
                  </div>
                  <AnimatedValueBadge
                    valueKey={wallDistanceVal.toFixed(1)}
                    displayValue={`-${wallDistanceVal.toFixed(1)}%`}
                    accent="purple"
                  />
                </div>
                <InstitutionalSlider
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
                  accent="purple"
                />
                <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>0.3% (Scalp)</span>
                  <span className="font-bold text-purple-400">
                    1.5% (Optimal)
                  </span>
                  <span>4.0% (Wide)</span>
                </div>
              </div>

              {/* 4. Telegram Wall Alerts Toggle & Telegram Min Whale Wall Size (USD) */}
              <motion.div
                animate={{
                  borderColor: formData.telegram_wall_alerts_enabled
                    ? "rgba(245, 158, 11, 0.35)"
                    : "rgba(39, 39, 42, 0.6)",
                  backgroundColor: formData.telegram_wall_alerts_enabled
                    ? "rgba(120, 53, 15, 0.08)"
                    : "rgba(8, 10, 15, 0.8)",
                }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border p-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Telegram Wall Alerts Toggle
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          formData.telegram_wall_alerts_enabled
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-zinc-800 bg-zinc-900/90 text-zinc-400"
                        }`}
                      >
                        {formData.telegram_wall_alerts_enabled
                          ? "ON (Bundled Digest)"
                          : "OFF (Breakouts Only)"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Default OFF keeps Telegram clean for breakout signals. When ON, only 85+ Score Binance walls &ge; threshold below are sent as a bundled digest.
                    </p>
                  </div>

                  <InstitutionalSwitch
                    checked={Boolean(formData.telegram_wall_alerts_enabled)}
                    onCheckedChange={(next) =>
                      updateField("telegram_wall_alerts_enabled", next)
                    }
                    accent="amber"
                  />
                </div>

                <div className="border-t border-zinc-800/60 pt-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label className="text-xs font-bold text-white">
                        Telegram Min Whale Wall Size (USD)
                      </label>
                      <p className="text-[11px] text-zinc-400">
                        Eliminates $5k micro-wall spam on Telegram (requires Score &ge; 85)
                      </p>
                    </div>
                    <AnimatedValueBadge
                      valueKey={telegramMinWallVal}
                      displayValue={`$${telegramMinWallVal.toLocaleString()}`}
                      accent="amber"
                    />
                  </div>
                  <InstitutionalSlider
                    min={5000}
                    max={100000}
                    step={2500}
                    value={telegramMinWallVal}
                    onChange={(val) =>
                      updateField("telegram_min_wall_usd", val)
                    }
                    accent="amber"
                  />
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>$5,000</span>
                    <span className="font-bold text-amber-400">
                      $15,000 (Recommended)
                    </span>
                    <span>$50,000</span>
                    <span>$100,000</span>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Section 2: Active Strategy Filters (Interactive Glowing Pill Grids) */}
            <section className="rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/40 to-zinc-950/70 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/50 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                    <Filter className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white">
                      Active Strategy Filters
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Disabled timeframes &amp; patterns are skipped by Alpha &amp; Spot scanners, DB, Telegram, and WebSockets
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleEnableAllStrategies}
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-cyan-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
                >
                  Enable All
                </motion.button>
              </div>

              {/* Timeframes Glowing Pill Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Enabled Timeframes</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-cyan-300">
                    {formData.enabled_timeframes.length} / {ALL_TIMEFRAMES.length} Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {ALL_TIMEFRAMES.map((tf) => {
                    const checked = formData.enabled_timeframes.includes(tf);
                    return (
                      <motion.button
                        key={tf}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleToggleTimeframe(tf)}
                        className={`group relative flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 ${
                          checked
                            ? "border-cyan-500/50 bg-gradient-to-r from-zinc-800 to-zinc-700/90 text-white shadow-[0_0_18px_rgba(6,182,212,0.14)]"
                            : "border-zinc-800/40 bg-zinc-900/40 text-zinc-600 hover:border-zinc-800 hover:text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                              checked
                                ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                                : "bg-zinc-700"
                            }`}
                          />
                          <span className="font-mono text-xs font-black uppercase tracking-wider">
                            {tf}
                          </span>
                        </div>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-md border transition-colors ${
                            checked
                              ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-300"
                              : "border-zinc-800 bg-zinc-950/60 text-transparent"
                          }`}
                        >
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Patterns Glowing Pill Grid */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <Layers className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Enabled Chart &amp; Quant Patterns (Alpha + Spot)</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-300">
                    {formData.enabled_patterns.length} / {ALL_PATTERNS.length} Active
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ALL_PATTERNS.map((pattern) => {
                    const checked = formData.enabled_patterns.includes(pattern);
                    const isSpotQuant = SPOT_QUANT_PATTERNS.has(pattern);
                    return (
                      <motion.button
                        key={pattern}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTogglePattern(pattern)}
                        className={`group flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 ${
                          checked
                            ? "border-emerald-500/50 bg-gradient-to-r from-zinc-800 to-zinc-700/90 text-white shadow-[0_0_16px_rgba(16,185,129,0.12)]"
                            : "border-zinc-800/40 bg-zinc-900/40 text-zinc-600 hover:border-zinc-800 hover:text-zinc-400"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2 pr-1">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                              checked
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                                : "bg-zinc-700"
                            }`}
                          />
                          <span className="truncate text-xs font-bold">
                            {formatPatternName(pattern)}
                          </span>
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                              checked
                                ? isSpotQuant
                                  ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                                  : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                                : "border-zinc-800 bg-zinc-900/80 text-zinc-600"
                            }`}
                          >
                            {isSpotQuant ? "Spot" : "Alpha"}
                          </span>
                        </div>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            checked
                              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
                              : "border-zinc-800 bg-zinc-950/60 text-transparent"
                          }`}
                        >
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (5 cols): Smart Filters, Alert Pacing, Blacklist & VIP Monetization */}
          <div className="space-y-6 lg:col-span-5">
            {/* Section 3: Strategy Guards & SMC Engine (Shadcn Switches + Framer Motion Row Highlight) */}
            <section className="rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/40 to-zinc-950/70 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-3.5">
              <div className="flex items-center gap-2.5 border-b border-zinc-800/50 pb-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">
                    Strategy Guards &amp; SMC Engine
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Institutional risk protection &amp; microstructure confirmation
                  </p>
                </div>
              </div>

              {/* Guard 1: SMC */}
              <motion.div
                animate={{
                  backgroundColor: formData.enable_smc
                    ? "rgba(6, 78, 59, 0.12)"
                    : "rgba(9, 9, 11, 0.6)",
                  borderColor: formData.enable_smc
                    ? "rgba(16, 185, 129, 0.32)"
                    : "rgba(39, 39, 42, 0.5)",
                }}
                transition={{ duration: 0.2 }}
                onClick={() => updateField("enable_smc", !formData.enable_smc)}
                className="flex cursor-pointer items-center justify-between rounded-xl border p-3.5"
              >
                <div className="pr-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <span>Smart Money Concepts (BoS &amp; Order Blocks)</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Boosts Pillar-3 score when institutional Break of Structure aligns
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <InstitutionalSwitch
                    checked={Boolean(formData.enable_smc)}
                    onCheckedChange={(next) => updateField("enable_smc", next)}
                  />
                </div>
              </motion.div>

              {/* Guard 2: Dead-Cat Bounce Filter */}
              <motion.div
                animate={{
                  backgroundColor: formData.enable_dead_cat
                    ? "rgba(6, 78, 59, 0.12)"
                    : "rgba(9, 9, 11, 0.6)",
                  borderColor: formData.enable_dead_cat
                    ? "rgba(16, 185, 129, 0.32)"
                    : "rgba(39, 39, 42, 0.5)",
                }}
                transition={{ duration: 0.2 }}
                onClick={() =>
                  updateField("enable_dead_cat", !formData.enable_dead_cat)
                }
                className="flex cursor-pointer items-center justify-between rounded-xl border p-3.5"
              >
                <div className="pr-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Anti-Spoof &amp; Dead-Cat Bounce Filter</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Penalizes coins with &lt;45% wall respect rate or dumped macro structure
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <InstitutionalSwitch
                    checked={Boolean(formData.enable_dead_cat)}
                    onCheckedChange={(next) =>
                      updateField("enable_dead_cat", next)
                    }
                  />
                </div>
              </motion.div>

              {/* Guard 3: Over-Extension Penalty */}
              <motion.div
                animate={{
                  backgroundColor: formData.enable_extension_penalty
                    ? "rgba(6, 78, 59, 0.12)"
                    : "rgba(9, 9, 11, 0.6)",
                  borderColor: formData.enable_extension_penalty
                    ? "rgba(16, 185, 129, 0.32)"
                    : "rgba(39, 39, 42, 0.5)",
                }}
                transition={{ duration: 0.2 }}
                onClick={() =>
                  updateField(
                    "enable_extension_penalty",
                    !formData.enable_extension_penalty
                  )
                }
                className="flex cursor-pointer items-center justify-between rounded-xl border p-3.5"
              >
                <div className="pr-3">
                  <span className="block text-xs font-bold text-white">
                    Over-Extension Guard (&gt;5% Above Neckline)
                  </span>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Marks pumped breakouts as &ldquo;Wait for Retest&rdquo; to prevent top-buying
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <InstitutionalSwitch
                    checked={Boolean(formData.enable_extension_penalty)}
                    onCheckedChange={(next) =>
                      updateField("enable_extension_penalty", next)
                    }
                  />
                </div>
              </motion.div>

              {/* Guard 4: Terminal Audio Ping */}
              <motion.div
                animate={{
                  backgroundColor: formData.enable_audio
                    ? "rgba(6, 78, 59, 0.12)"
                    : "rgba(9, 9, 11, 0.6)",
                  borderColor: formData.enable_audio
                    ? "rgba(16, 185, 129, 0.32)"
                    : "rgba(39, 39, 42, 0.5)",
                }}
                transition={{ duration: 0.2 }}
                onClick={() =>
                  updateField("enable_audio", !formData.enable_audio)
                }
                className="flex cursor-pointer items-center justify-between rounded-xl border p-3.5"
              >
                <div className="pr-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>Terminal Audio Ping on High-Score Signal</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Plays subtle institutional sonar chime when 75+ signal arrives
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <InstitutionalSwitch
                    checked={Boolean(formData.enable_audio)}
                    onCheckedChange={(next) =>
                      updateField("enable_audio", next)
                    }
                  />
                </div>
              </motion.div>
            </section>

            {/* Section 4: Alert Pacing & Cooldowns (- / + Counter Components) */}
            <section className="rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/40 to-zinc-950/70 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-zinc-800/50 pb-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
                  <Bell className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">
                    Alert Pacing &amp; Cooldown
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Fine-tune dispatch cadence &amp; anti-spam throttling
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InstitutionalCounter
                  label="Re-Alert Cooldown"
                  unit="MINS"
                  min={5}
                  max={240}
                  step={5}
                  value={formData.cooldown_minutes}
                  accentClass="text-white"
                  onChange={(val) => updateField("cooldown_minutes", val)}
                />

                <InstitutionalCounter
                  label="Wall Alert Cooldown"
                  unit="MINS"
                  min={5}
                  max={720}
                  step={15}
                  value={formData.telegram_wall_cooldown_minutes ?? 120}
                  accentClass="text-amber-300"
                  onChange={(val) =>
                    updateField("telegram_wall_cooldown_minutes", val)
                  }
                />

                <InstitutionalCounter
                  label="Max Alerts / Cycle"
                  unit="MAX"
                  min={1}
                  max={25}
                  step={1}
                  value={formData.max_alerts_per_cycle}
                  accentClass="text-cyan-300"
                  onChange={(val) => updateField("max_alerts_per_cycle", val)}
                />
              </div>
            </section>

            {/* Section 5: Token Blacklist Manager (Spring Animated Badges & Crimson Delete) */}
            <section className="rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/40 to-zinc-950/70 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10">
                    <Ban className="h-3.5 w-3.5 text-rose-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white">
                      Token Blacklist Manager
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Instantly block noisy or spoofed tokens across Alpha, Spot, Live Walls &amp; Telegram
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-rose-300">
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
                  placeholder="e.g. FARTCOIN, DGAI or PEPE"
                  className="flex-1 rounded-xl border border-zinc-800 bg-[#080A0F] px-3.5 py-2.5 font-mono text-xs text-white placeholder-zinc-600 transition focus:border-rose-500/70 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={isUpdatingBlacklist || !blacklistInput.trim()}
                  onClick={() => handleBlacklistAction(blacklistInput, "add")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-extrabold text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/25 disabled:opacity-40"
                >
                  <Ban className="h-3.5 w-3.5 text-rose-400" />
                  <span>Add to Blacklist</span>
                </motion.button>
              </div>

              {blacklistedSymbols.length === 0 ? (
                <div className="rounded-xl border border-zinc-800/50 bg-[#080A0F]/60 px-3.5 py-3.5 text-center font-mono text-xs text-zinc-500">
                  No tokens are currently blacklisted. Add a symbol above to exclude it from all scans.
                </div>
              ) : (
                <motion.div
                  layout
                  className="flex flex-wrap items-center gap-2 pt-1"
                >
                  <AnimatePresence mode="popLayout">
                    {blacklistedSymbols.map((sym) => (
                      <motion.span
                        key={sym}
                        layout
                        initial={{ opacity: 0, scale: 0.75, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.65, y: -4 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 22,
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 pl-2.5 pr-1.5 py-1 font-mono text-xs font-bold text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.08)]"
                      >
                        <span>{sym}</span>
                        <button
                          type="button"
                          disabled={isUpdatingBlacklist}
                          onClick={() => handleBlacklistAction(sym, "remove")}
                          title={`Remove ${sym} from Blacklist`}
                          className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-rose-950/80 text-rose-500 transition hover:bg-rose-600 hover:text-white disabled:opacity-50"
                        >
                          ✖
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </section>

            {/* Section 6: VIP Key Generator & Subscriptions (Golden/Amber Institutional Accent + Sweeping Glare Hover) */}
            <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.05] via-zinc-900/50 to-zinc-950/90 p-6 shadow-[0_0_35px_rgba(245,158,11,0.05),inset_0_1px_0_0_rgba(251,191,36,0.12)] space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                    <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-amber-100">
                      VIP Key Generator &amp; Subscriptions
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Issue auto-expiring 7-Day Trial ($5) or 30-Day Monthly ($15) VIP keys
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                  {vipKeys.filter((k) => k.status === "active").length} Active
                </span>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Buyer Name / Telegram @username (Optional)
                </label>
                <input
                  type="text"
                  value={buyerLabel}
                  onChange={(e) => setBuyerLabel(e.target.value)}
                  placeholder="e.g. @ali_trader or Bilal (Easypaisa)"
                  className="w-full rounded-xl border border-zinc-800 bg-[#080A0F]/90 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                />

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={isGeneratingKey}
                    onClick={() => handleGenerateVipKey("7d_trial")}
                    className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-500/15 to-amber-600/20 px-3.5 py-2.5 text-xs font-extrabold text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.12)] transition hover:border-amber-400/70 hover:text-white disabled:opacity-50 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span>Generate 7-Day Trial ($5)</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={isGeneratingKey}
                    onClick={() => handleGenerateVipKey("30d_monthly")}
                    className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-3.5 py-2.5 text-xs font-extrabold text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.12)] transition hover:border-emerald-400/70 hover:text-white disabled:opacity-50 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full"
                  >
                    <Crown className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Generate 30-Day Monthly ($15)</span>
                  </motion.button>
                </div>
              </div>

              {newlyGeneratedKey && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        New Key Ready to Dispatch
                      </span>
                      <span className="font-mono text-base font-black text-white">
                        {newlyGeneratedKey.key_code}
                      </span>
                    </div>
                    <span className="rounded border border-amber-400/30 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                      {newlyGeneratedKey.plan_type === "7d_trial"
                        ? "7D Trial ($5)"
                        : "30D Monthly ($15)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Expires:{" "}
                    <strong className="font-mono text-white">
                      {new Date(newlyGeneratedKey.expires_at).toLocaleString()}
                    </strong>
                    {newlyGeneratedKey.label
                      ? ` • Buyer: ${newlyGeneratedKey.label}`
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyWelcomeMessage(newlyGeneratedKey)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-emerald-400 px-3 py-2 text-xs font-black text-zinc-950 transition hover:brightness-110"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Key &amp; Welcome Message</span>
                  </button>
                </motion.div>
              )}

              {/* Generated Keys List */}
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {vipKeys.length === 0 ? (
                  <p className="py-4 text-center font-mono text-xs text-zinc-500">
                    No VIP keys generated yet. Click a plan button above to issue one.
                  </p>
                ) : (
                  vipKeys.map((k) => {
                    const statusColor =
                      k.status === "active"
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                        : k.status === "expired"
                        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                        : "border-rose-500/30 bg-rose-500/15 text-rose-300";

                    const daysLeft = (k.remaining_hours / 24).toFixed(1);

                    return (
                      <div
                        key={k.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/70 bg-[#080A0F]/90 px-3 py-2.5 text-xs transition hover:border-zinc-700/80"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-white">
                              {k.key_code}
                            </span>
                            <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                              {k.plan_type === "7d_trial"
                                ? "7D Trial"
                                : "30D Monthly"}
                            </span>
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${statusColor}`}
                            >
                              {k.status}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-zinc-400">
                            {k.label ? (
                              <span className="font-sans font-semibold text-zinc-300">
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
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyRawKey(k.key_code)}
                            title="Copy Raw Key Code"
                            className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-1 font-mono text-[10px] text-zinc-400 transition hover:text-white"
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
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/25"
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
          </div>

          {/* Bottom Full-Width Destructive Action: Telemetry & Database Reset */}
          <div className="lg:col-span-12">
            <section className="rounded-2xl border border-red-900/35 bg-gradient-to-r from-red-950/15 via-zinc-950/90 to-red-950/15 p-6 shadow-[inset_0_1px_0_0_rgba(239,68,68,0.06)]">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
                    <Database className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-red-200">
                        Destructive Zone • Telemetry &amp; Database Reset
                      </h2>
                      <span className="rounded border border-red-900/60 bg-red-950/50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-red-400">
                        Irreversible
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Wipe historical Alpha signals, win-rate outcomes &amp; Spot registry state to benchmark new strategy filters cleanly from zero.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={handleResetTelemetryClick}
                    disabled={isWiping}
                    className={`inline-flex min-w-[260px] items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-black tracking-wide transition-all duration-200 disabled:opacity-60 ${
                      confirmWipe
                        ? "border-amber-400 bg-amber-500 text-zinc-950 shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:bg-amber-400"
                        : "border-red-900/50 bg-red-950/20 text-red-400 hover:border-red-500 hover:bg-red-600 hover:text-white hover:shadow-[0_0_24px_rgba(220,38,38,0.4)]"
                    }`}
                  >
                    {isWiping ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Wiping Database &amp; Spot Registry...</span>
                      </>
                    ) : confirmWipe ? (
                      <span>⚠️ Click Again to Confirm Full DB Wipe</span>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>Reset Telemetry &amp; Start Fresh</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {wipeBanner && (
                <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 font-mono text-xs font-bold text-emerald-300">
                  {wipeBanner}
                </div>
              )}
            </section>
          </div>
        </form>

        {/* Save Confirmation Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border bg-zinc-950/95 px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-xl ${
                toast.variant === "synced"
                  ? "border-emerald-500/40 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                  : "border-amber-500/40 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.2)]"
              }`}
            >
              {toast.variant === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
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
