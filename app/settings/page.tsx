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
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Filter,
  Trash2,
  Loader2,
  KeyRound,
  Copy,
  Ban,
  Zap,
  Crown,
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

function CompactSwitch({
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-150 focus:outline-none ${
        checked
          ? "border-emerald-600/60 bg-emerald-600/30"
          : "border-gray-700 bg-gray-800/80"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
          checked
            ? "translate-x-4 bg-emerald-400"
            : "translate-x-0 bg-gray-500"
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
      }, 3200);
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
            planType === "7d_trial" ? "7D Trial" : "30D Monthly"
          }: ${created.key_code}`,
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
      showToast(`Copied ${rec.key_code} & welcome message!`, "synced");
    } catch {
      showToast("Clipboard copy failed.", "local");
    }
  };

  const handleCopyRawKey = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Copied key ${code}!`, "synced");
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
            ? `Added ${cleanSym} to Blacklist`
            : `Removed ${cleanSym} from Blacklist`,
          "synced"
        );
      } else {
        showToast(`Failed to ${action} ${cleanSym}.`, "local");
      }
    } catch {
      showToast(`Updated ${cleanSym} locally (Backend offline).`, "local");
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
      const successMsg = "Database & Spot Registry wiped. Tracking from 0.";
      setWipeBanner(successMsg);
      showToast(successMsg, "synced");
    } else {
      showToast("Failed to wipe telemetry.", "local");
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
        ? `Timeframe ${tf.toUpperCase()} ${isEnabled ? "off" : "on"} (${nextTfs.length}/${ALL_TIMEFRAMES.length})`
        : `Timeframe ${tf.toUpperCase()} saved locally`,
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
        ? `${formatPatternName(pattern)} ${isEnabled ? "off" : "on"} (${nextPatterns.length}/${ALL_PATTERNS.length})`
        : `${formatPatternName(pattern)} saved locally`,
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
        ? "All timeframes & patterns enabled."
        : "Enabled locally (Backend offline).",
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
        `Saved & synced (Min Score: ${formData.min_score}).`,
        "synced"
      );
    } else {
      showToast(
        `Saved locally (Min Score: ${formData.min_score}).`,
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
        ? "Restored recommended defaults (68)."
        : "Restored defaults locally.",
      ok ? "synced" : "local"
    );
  };

  const wallDistanceVal = Number(
    formData.max_wall_distance_pct ?? formData.proximity_pct ?? 1.5
  );
  const telegramMinWallVal = Number(formData.telegram_min_wall_usd ?? 15000);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-100">
      {/* Compact Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800/70 bg-[#0B0E14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-400 transition hover:border-gray-700 hover:text-white"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-emerald-400" />
              <h1 className="text-sm font-bold tracking-tight text-white">
                Bot Control Center
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/60 bg-emerald-900/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/80 px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition hover:border-gray-700 hover:text-white"
            >
              <RotateCcw className="h-3 w-3 text-gray-400" />
              <span>Reset (68)</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* High-Density 4-Column Main Grid */}
      <main className="mx-auto max-w-[1600px] p-4">
        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4"
        >
          {/* Card 1: Core Thresholds & Strategy Guards */}
          <section className="rounded-xl border border-gray-800/80 bg-gray-900/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800/70 pb-2">
              <div className="flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Thresholds &amp; Gates
                </h2>
              </div>
              <span className="font-mono text-[10px] text-gray-500">4-PILLAR</span>
            </div>

            {/* Compact Inline Number Inputs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-200">
                  Min 4-Pillar Score
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={40}
                    max={90}
                    step={1}
                    value={formData.min_score}
                    onChange={(e) =>
                      updateField("min_score", Number(e.target.value))
                    }
                    className="w-20 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="font-mono text-xs text-gray-400">/100</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-200">
                  Web Radar Min Wall ($)
                </label>
                <input
                  type="number"
                  min={2000}
                  max={50000}
                  step={500}
                  value={formData.min_wall_usd}
                  onChange={(e) =>
                    updateField("min_wall_usd", Number(e.target.value))
                  }
                  className="w-24 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-200">
                  Max Wall Distance (%)
                </label>
                <input
                  type="number"
                  min={0.3}
                  max={4.0}
                  step={0.1}
                  value={wallDistanceVal}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      max_wall_distance_pct: val,
                      proximity_pct: val,
                    }));
                  }}
                  className="w-20 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800/50">
                <label className="text-sm text-gray-200">
                  Telegram Wall Alerts
                </label>
                <CompactSwitch
                  checked={Boolean(formData.telegram_wall_alerts_enabled)}
                  onCheckedChange={(next) =>
                    updateField("telegram_wall_alerts_enabled", next)
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-200">
                  Telegram Min Wall ($)
                </label>
                <input
                  type="number"
                  min={5000}
                  max={100000}
                  step={1000}
                  value={telegramMinWallVal}
                  onChange={(e) =>
                    updateField("telegram_min_wall_usd", Number(e.target.value))
                  }
                  className="w-24 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tightly Grouped Inline Strategy Guards */}
            <div className="border-t border-gray-800/70 pt-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Strategy Guards
                </h3>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-200">
                    Smart Money Concepts (BoS/OB)
                  </span>
                  <CompactSwitch
                    checked={Boolean(formData.enable_smc)}
                    onCheckedChange={(next) => updateField("enable_smc", next)}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-200">
                    Anti-Spoof &amp; Dead-Cat Filter
                  </span>
                  <CompactSwitch
                    checked={Boolean(formData.enable_dead_cat)}
                    onCheckedChange={(next) =>
                      updateField("enable_dead_cat", next)
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-200">
                    Over-Extension Guard (&gt;5%)
                  </span>
                  <CompactSwitch
                    checked={Boolean(formData.enable_extension_penalty)}
                    onCheckedChange={(next) =>
                      updateField("enable_extension_penalty", next)
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-200">
                    Terminal Audio Sonar Ping
                  </span>
                  <CompactSwitch
                    checked={Boolean(formData.enable_audio)}
                    onCheckedChange={(next) =>
                      updateField("enable_audio", next)
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Grid-Based Timeframe & Pattern Selectors */}
          <section className="rounded-xl border border-gray-800/80 bg-gray-900/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800/70 pb-2">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Strategy Filters
                </h2>
              </div>
              <button
                type="button"
                onClick={handleEnableAllStrategies}
                className="rounded-full border border-emerald-800 bg-emerald-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-900/50"
              >
                Enable All
              </button>
            </div>

            {/* Enabled Timeframes (4-column dense pill grid) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">
                  Enabled Timeframes
                </span>
                <span className="font-mono text-xs text-gray-400">
                  {formData.enabled_timeframes.length}/{ALL_TIMEFRAMES.length}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ALL_TIMEFRAMES.map((tf) => {
                  const active = formData.enabled_timeframes.includes(tf);
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => handleToggleTimeframe(tf)}
                      className={`px-3 py-1 text-xs rounded-full border font-mono font-semibold uppercase transition ${
                        active
                          ? "bg-emerald-900/30 text-emerald-400 border-emerald-800"
                          : "bg-gray-800/50 text-gray-500 border-gray-700 hover:text-gray-300"
                      }`}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enabled Chart Patterns (Compact wrapping pill grid, no ALPHA/SPOT sub-badges) */}
            <div className="space-y-1.5 border-t border-gray-800/70 pt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">
                  Enabled Chart Patterns
                </span>
                <span className="font-mono text-xs text-gray-400">
                  {formData.enabled_patterns.length}/{ALL_PATTERNS.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_PATTERNS.map((pattern) => {
                  const active = formData.enabled_patterns.includes(pattern);
                  return (
                    <button
                      key={pattern}
                      type="button"
                      onClick={() => handleTogglePattern(pattern)}
                      className={`px-3 py-1 text-xs rounded-full border font-medium transition ${
                        active
                          ? "bg-emerald-900/30 text-emerald-400 border-emerald-800"
                          : "bg-gray-800/50 text-gray-500 border-gray-700 hover:text-gray-300"
                      }`}
                    >
                      {formatPatternName(pattern)}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Card 3: Consolidated Operations & Limits (Alert Pacing + Token Blacklist) */}
          <section className="rounded-xl border border-gray-800/80 bg-gray-900/40 p-3.5 space-y-3 lg:col-span-1 xl:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-800/70 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Operations &amp; Limits
              </h2>
              <span className="font-mono text-xs text-gray-400">
                {blacklistedSymbols.length} Blocked
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Sub-Column 1: Alert Pacing & Cooldowns */}
              <div className="space-y-2">
                <span className="block text-xs text-gray-400 uppercase font-semibold">
                  Alert Pacing &amp; Cooldowns
                </span>

                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-gray-200">
                    Re-Alert Cooldown (m)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={formData.cooldown_minutes}
                    onChange={(e) =>
                      updateField("cooldown_minutes", Number(e.target.value))
                    }
                    className="w-20 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-gray-200">
                    Wall Alert Cooldown (m)
                  </label>
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
                    className="w-20 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-gray-200">
                    Max Alerts / Cycle
                  </label>
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
                    className="w-20 rounded-md border border-gray-800 bg-gray-950 px-2 py-1 text-right font-mono text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sub-Column 2: Token Blacklist Manager */}
              <div className="space-y-2 md:border-l md:border-gray-800/70 md:pl-4">
                <span className="block text-xs text-gray-400 uppercase font-semibold">
                  Token Blacklist
                </span>

                <div className="flex items-center gap-1.5">
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
                    placeholder="Symbol (e.g. PEPE)"
                    className="min-w-0 flex-1 rounded-md border border-gray-800 bg-gray-950 px-2.5 py-1 font-mono text-xs text-white placeholder-gray-600 focus:border-rose-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isUpdatingBlacklist || !blacklistInput.trim()}
                    onClick={() => handleBlacklistAction(blacklistInput, "add")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-800/70 bg-rose-900/30 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/50 disabled:opacity-40"
                  >
                    <Ban className="h-3 w-3" />
                    <span>Block</span>
                  </button>
                </div>

                {blacklistedSymbols.length === 0 ? (
                  <p className="text-xs text-gray-500">No tokens blocked.</p>
                ) : (
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {blacklistedSymbols.map((sym) => (
                      <span
                        key={sym}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-800/60 bg-rose-950/40 px-2.5 py-0.5 font-mono text-xs text-rose-300"
                      >
                        <span>{sym}</span>
                        <button
                          type="button"
                          disabled={isUpdatingBlacklist}
                          onClick={() => handleBlacklistAction(sym, "remove")}
                          className="text-rose-400 hover:text-white"
                          title={`Unblock ${sym}`}
                        >
                          ✖
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Card 4: Condensed VIP Key Generator & Table */}
          <section className="rounded-xl border border-gray-800/80 bg-gray-900/40 p-3.5 space-y-2.5 lg:col-span-3 xl:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/70 pb-2">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  VIP Key Generator
                </h2>
                <span className="rounded-full border border-emerald-800/60 bg-emerald-900/30 px-2 py-0.2 font-mono text-[10px] text-emerald-400">
                  {vipKeys.filter((k) => k.status === "active").length} Active
                </span>
              </div>

              {newlyGeneratedKey && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-xs">
                  <span className="font-mono font-bold text-emerald-300">
                    {newlyGeneratedKey.key_code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyWelcomeMessage(newlyGeneratedKey)}
                    className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-gray-950 hover:bg-emerald-400"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy Welcome</span>
                  </button>
                </div>
              )}
            </div>

            {/* Single Flex Row for Input + Generate Buttons */}
            <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={buyerLabel}
                onChange={(e) => setBuyerLabel(e.target.value)}
                placeholder="Buyer label / Telegram @username (optional)"
                className="min-w-[180px] flex-1 rounded-lg border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={isGeneratingKey}
                onClick={() => handleGenerateVipKey("7d_trial")}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-800/70 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/50 disabled:opacity-50"
              >
                <Zap className="h-3 w-3 text-amber-400" />
                <span>7D Trial ($5)</span>
              </button>
              <button
                type="button"
                disabled={isGeneratingKey}
                onClick={() => handleGenerateVipKey("30d_monthly")}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-800/70 bg-emerald-900/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/50 disabled:opacity-50"
              >
                <Crown className="h-3 w-3 text-emerald-400" />
                <span>30D Monthly ($15)</span>
              </button>
            </div>

            {/* Condensed Keys Table */}
            {vipKeys.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-800/70 bg-gray-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-gray-800 bg-gray-900/90 text-[10px] uppercase text-gray-400">
                    <tr>
                      <th className="px-2.5 py-1.5">Key</th>
                      <th className="px-2 py-1.5">Plan</th>
                      <th className="px-2 py-1.5">Buyer</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Remaining</th>
                      <th className="px-2.5 py-1.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {vipKeys.map((k) => {
                      const daysLeft = (k.remaining_hours / 24).toFixed(1);
                      return (
                        <tr key={k.id} className="hover:bg-gray-900/40">
                          <td className="px-2.5 py-1.5 font-mono font-bold text-white">
                            {k.key_code}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-gray-400">
                            {k.plan_type === "7d_trial" ? "7D" : "30D"}
                          </td>
                          <td className="px-2 py-1.5 text-gray-300">
                            {k.label || "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                                k.status === "active"
                                  ? "bg-emerald-900/30 text-emerald-400"
                                  : k.status === "expired"
                                  ? "bg-amber-900/30 text-amber-400"
                                  : "bg-rose-900/30 text-rose-400"
                              }`}
                            >
                              {k.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-mono text-gray-400">
                            {k.status === "active"
                              ? `${daysLeft}d`
                              : new Date(k.expires_at).toLocaleDateString()}
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCopyWelcomeMessage(k)}
                                className="rounded border border-gray-800 bg-gray-900 px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white"
                              >
                                Msg
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyRawKey(k.key_code)}
                                className="rounded border border-gray-800 bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 hover:text-white"
                              >
                                Key
                              </button>
                              {k.status === "active" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRevokeVipKey(k.id, k.key_code)
                                  }
                                  className="rounded border border-rose-900/60 bg-rose-950/40 px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-900/40"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Slim Minimal Destructive Banner at Bottom */}
          <div className="lg:col-span-3 xl:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-900/40 bg-red-950/10 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                  Telemetry Reset
                </span>
                <span className="text-xs text-gray-400">
                  {wipeBanner ||
                    "Wipe historical Alpha signals, outcomes & Spot registry state."}
                </span>
              </div>

              <button
                type="button"
                onClick={handleResetTelemetryClick}
                disabled={isWiping}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${
                  confirmWipe
                    ? "border-amber-500 bg-amber-500 text-gray-950"
                    : "border-red-900/60 bg-red-950/30 text-red-400 hover:bg-red-600 hover:text-white"
                }`}
              >
                {isWiping ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Wiping...</span>
                  </>
                ) : confirmWipe ? (
                  <span>Confirm Full DB Wipe</span>
                ) : (
                  <>
                    <Trash2 className="h-3 w-3" />
                    <span>Reset Telemetry</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Compact Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border bg-gray-950/95 px-3.5 py-2 text-xs font-semibold shadow-xl ${
                toast.variant === "synced"
                  ? "border-emerald-500/40 text-emerald-300"
                  : "border-amber-500/40 text-amber-300"
              }`}
            >
              {toast.variant === "synced" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
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
