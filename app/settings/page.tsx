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
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Trash2,
  Loader2,
  Copy,
  Ban,
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

const SCORE_PRESETS = [
  { value: 40, label: "40 · Loose" },
  { value: 55, label: "55 · Moderate" },
  { value: 68, label: "68 · Institutional" },
  { value: 90, label: "90 · Strict" },
] as const;

const WEB_WALL_PRESETS = [
  { value: 2000, label: "$2K" },
  { value: 5000, label: "$5K" },
  { value: 15000, label: "$15K" },
  { value: 50000, label: "$50K" },
] as const;

const WALL_DISTANCE_PRESETS = [
  { value: 0.3, label: "0.3% · Scalp" },
  { value: 1.5, label: "1.5% · Optimal" },
  { value: 4.0, label: "4.0% · Wide" },
] as const;

const TELEGRAM_WALL_PRESETS = [
  { value: 5000, label: "$5K" },
  { value: 15000, label: "$15K" },
  { value: 50000, label: "$50K" },
  { value: 100000, label: "$100K" },
] as const;

function CyanToggle({
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
          ? "border-cyan-500/60 bg-cyan-500/30"
          : "border-slate-700 bg-slate-800"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
          checked
            ? "translate-x-4 bg-cyan-400"
            : "translate-x-0 bg-slate-500"
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
            planType === "7d_trial" ? "7-Day" : "30-Day"
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
            ? `Added ${cleanSym} to Token Blacklist`
            : `Removed ${cleanSym} from Token Blacklist`,
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
        "Database & Spot Registry wiped! Tracking fresh signals from 0.";
      setWipeBanner(successMsg);
      showToast(successMsg, "synced");
    } else {
      showToast(
        "Failed to wipe telemetry — check backend connection.",
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

  const handleSaveConfiguration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
  const activeVipCount = vipKeys.filter((k) => k.status === "active").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 pb-20 space-y-6">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-white"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">
                Bot Control Center
              </h1>
              <p className="text-xs text-slate-400">
                Thresholds, strategy filters &amp; alert routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset (68)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveConfiguration()}
              disabled={isSaving}
              className="bg-cyan-500 text-black font-semibold rounded-md px-4 py-2 text-xs transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </header>

        {/* Main 2-Column Body: 60% / 40% */}
        <form
          onSubmit={handleSaveConfiguration}
          className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6 items-start"
        >
          {/* Left Column (60%): QUANT ENGINE THRESHOLDS & STRATEGY FILTERS */}
          <div className="space-y-6 min-w-0">
            {/* QUANT ENGINE THRESHOLDS Card */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  QUANT ENGINE THRESHOLDS
                </h2>
                <span className="rounded border border-cyan-500/30 bg-cyan-900/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-400">
                  LIVE SYNC
                </span>
              </div>

              {/* 1. Min 4-Pillar Signal Score (Slider + 4 Segmented Buttons) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200">
                    Min 4-Pillar Signal Score
                  </label>
                  <span className="font-mono text-sm font-bold text-cyan-400">
                    {formData.min_score} / 100
                  </span>
                </div>

                <input
                  type="range"
                  min={40}
                  max={90}
                  step={1}
                  value={formData.min_score}
                  onChange={(e) =>
                    updateField("min_score", Number(e.target.value))
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-500"
                />

                <div className="grid grid-cols-4 gap-2 text-xs">
                  {SCORE_PRESETS.map((preset) => {
                    const active = formData.min_score === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => updateField("min_score", preset.value)}
                        className={`rounded-md border px-2.5 py-1.5 font-mono text-xs font-medium transition ${
                          active
                            ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
                            : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Web Radar Min Bid Wall (4 Segmented Buttons - No Slider) */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200">
                    Web Radar Min Bid Wall
                  </label>
                  <span className="font-mono text-xs font-semibold text-cyan-400">
                    ${formData.min_wall_usd.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  {WEB_WALL_PRESETS.map((preset) => {
                    const active = formData.min_wall_usd === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          updateField("min_wall_usd", preset.value)
                        }
                        className={`rounded-md border px-3 py-2 font-mono text-xs font-semibold transition ${
                          active
                            ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
                            : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Max Bid Wall Distance (3 Segmented Buttons - No Slider) */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200">
                    Max Bid Wall Distance
                  </label>
                  <span className="font-mono text-xs font-semibold text-cyan-400">
                    -{wallDistanceVal.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {WALL_DISTANCE_PRESETS.map((preset) => {
                    const active =
                      Math.abs(wallDistanceVal - preset.value) < 0.05;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setDraft((prev) => ({
                            ...(prev ?? {}),
                            max_wall_distance_pct: preset.value,
                            proximity_pct: preset.value,
                          }));
                        }}
                        className={`rounded-md border px-3 py-2 font-mono text-xs font-semibold transition ${
                          active
                            ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
                            : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Telegram Wall Alerts & Min Whale Wall */}
              <div className="space-y-3 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">
                    Telegram Wall Alerts (85+ Score Bundled Digest)
                  </span>
                  <CyanToggle
                    checked={Boolean(formData.telegram_wall_alerts_enabled)}
                    onCheckedChange={(next) =>
                      updateField("telegram_wall_alerts_enabled", next)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-400">
                      Telegram Min Whale Wall
                    </label>
                    <span className="font-mono text-xs font-semibold text-cyan-400">
                      ${telegramMinWallVal.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {TELEGRAM_WALL_PRESETS.map((preset) => {
                      const active = telegramMinWallVal === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() =>
                            updateField("telegram_min_wall_usd", preset.value)
                          }
                          className={`rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition ${
                            active
                              ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
                              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* ACTIVE STRATEGY FILTERS Card */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  ACTIVE STRATEGY FILTERS
                </h2>
                <button
                  type="button"
                  onClick={handleEnableAllStrategies}
                  className="rounded border border-cyan-500/40 bg-cyan-900/20 px-2.5 py-1 text-xs font-medium text-cyan-400 transition hover:bg-cyan-900/30"
                >
                  Enable All
                </button>
              </div>

              {/* Timeframes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Enabled Timeframes</span>
                  <span className="font-mono text-slate-400">
                    {formData.enabled_timeframes.length}/{ALL_TIMEFRAMES.length}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {ALL_TIMEFRAMES.map((tf) => {
                    const active = formData.enabled_timeframes.includes(tf);
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => handleToggleTimeframe(tf)}
                        className={`rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase transition ${
                          active
                            ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
                            : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chart & Quant Patterns */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Enabled Chart &amp; Quant Patterns
                  </span>
                  <span className="font-mono text-slate-400">
                    {formData.enabled_patterns.length}/{ALL_PATTERNS.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {ALL_PATTERNS.map((pattern) => {
                    const active = formData.enabled_patterns.includes(pattern);
                    return (
                      <button
                        key={pattern}
                        type="button"
                        onClick={() => handleTogglePattern(pattern)}
                        className={`truncate rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                          active
                            ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
                            : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {formatPatternName(pattern)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (40%): TOKEN BLACKLIST, VIP KEY GENERATOR, GUARDS & PACING */}
          <div className="space-y-6 min-w-0 lg:pr-6">
            {/* TOKEN BLACKLIST Card */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  TOKEN BLACKLIST
                </h2>
                <span className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  {blacklistedSymbols.length} blocked
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
                  placeholder="Symbol (e.g. FARTCOIN, PEPE)"
                  className="bg-slate-950 border border-slate-800 flex-grow rounded-md px-3 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isUpdatingBlacklist || !blacklistInput.trim()}
                  onClick={() => handleBlacklistAction(blacklistInput, "add")}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:opacity-40"
                >
                  Add
                </button>
              </div>

              {blacklistedSymbols.length === 0 ? (
                <p className="text-xs text-slate-500">No tokens blocked.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {blacklistedSymbols.map((sym) => (
                    <span
                      key={sym}
                      className="border border-slate-700 bg-slate-800/40 rounded px-2 py-1 flex items-center gap-1.5 text-xs font-mono text-slate-200"
                    >
                      <span>{sym}</span>
                      <button
                        type="button"
                        disabled={isUpdatingBlacklist}
                        onClick={() => handleBlacklistAction(sym, "remove")}
                        className="text-slate-400 hover:text-rose-400"
                        title={`Remove ${sym}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* VIP KEY GENERATOR Card */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  VIP KEY GENERATOR
                </h2>
                <span className="rounded border border-cyan-500/30 bg-cyan-900/20 px-2 py-0.5 font-mono text-[11px] text-cyan-400">
                  {activeVipCount} active
                </span>
              </div>

              <input
                type="text"
                value={buyerLabel}
                onChange={(e) => setBuyerLabel(e.target.value)}
                placeholder="Buyer name / Telegram @ (optional)"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isGeneratingKey}
                  onClick={() => handleGenerateVipKey("7d_trial")}
                  className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
                >
                  7-Day - $5
                </button>

                <button
                  type="button"
                  disabled={isGeneratingKey}
                  onClick={() => handleGenerateVipKey("30d_monthly")}
                  className="rounded-md border border-cyan-500/50 bg-cyan-900/20 px-3 py-2 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-900/30 disabled:opacity-50"
                >
                  30-Day - $15
                </button>
              </div>

              {newlyGeneratedKey && (
                <div className="rounded-md border border-cyan-500/40 bg-cyan-950/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">
                      {newlyGeneratedKey.key_code}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyWelcomeMessage(newlyGeneratedKey)
                      }
                      className="inline-flex items-center gap-1 rounded bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-black hover:bg-cyan-400"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Copy Welcome</span>
                    </button>
                  </div>
                </div>
              )}

              {vipKeys.length > 0 && (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pt-1">
                  {vipKeys.map((k) => {
                    const daysLeft = (k.remaining_hours / 24).toFixed(1);
                    return (
                      <div
                        key={k.id}
                        className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-mono font-semibold text-slate-200">
                            {k.key_code}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            {k.label ? `${k.label} · ` : ""}
                            {k.status === "active"
                              ? `${daysLeft}d`
                              : k.status}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyWelcomeMessage(k)}
                            className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyRawKey(k.key_code)}
                            className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-white"
                          >
                            Key
                          </button>
                          {k.status === "active" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRevokeVipKey(k.id, k.key_code)
                              }
                              className="rounded border border-rose-900/50 bg-rose-950/30 px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-900/40"
                            >
                              <Ban className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* STRATEGY GUARDS & ALERT PACING Card */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  STRATEGY GUARDS &amp; PACING
                </h2>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">
                    Smart Money Concepts (BoS &amp; OB)
                  </span>
                  <CyanToggle
                    checked={Boolean(formData.enable_smc)}
                    onCheckedChange={(next) => updateField("enable_smc", next)}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">
                    Anti-Spoof &amp; Dead-Cat Filter
                  </span>
                  <CyanToggle
                    checked={Boolean(formData.enable_dead_cat)}
                    onCheckedChange={(next) =>
                      updateField("enable_dead_cat", next)
                    }
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">
                    Over-Extension Guard (&gt;5%)
                  </span>
                  <CyanToggle
                    checked={Boolean(formData.enable_extension_penalty)}
                    onCheckedChange={(next) =>
                      updateField("enable_extension_penalty", next)
                    }
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">
                    Terminal Audio Sonar Ping
                  </span>
                  <CyanToggle
                    checked={Boolean(formData.enable_audio)}
                    onCheckedChange={(next) =>
                      updateField("enable_audio", next)
                    }
                  />
                </div>
              </div>

              {/* Cooldowns */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/70">
                <div>
                  <label className="block text-[11px] text-slate-400">
                    Signal Cooldown
                  </label>
                  <div className="mt-1 flex items-center rounded border border-slate-800 bg-slate-950 px-2 py-1">
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={formData.cooldown_minutes}
                      onChange={(e) =>
                        updateField("cooldown_minutes", Number(e.target.value))
                      }
                      className="w-full bg-transparent font-mono text-xs font-semibold text-slate-200 focus:outline-none"
                    />
                    <span className="font-mono text-[10px] text-slate-500">
                      m
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400">
                    Wall Cooldown
                  </label>
                  <div className="mt-1 flex items-center rounded border border-slate-800 bg-slate-950 px-2 py-1">
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
                      className="w-full bg-transparent font-mono text-xs font-semibold text-slate-200 focus:outline-none"
                    />
                    <span className="font-mono text-[10px] text-slate-500">
                      m
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400">
                    Max / Cycle
                  </label>
                  <div className="mt-1 flex items-center rounded border border-slate-800 bg-slate-950 px-2 py-1">
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
                      className="w-full bg-transparent font-mono text-xs font-semibold text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Telemetry Reset */}
              <div className="pt-3 border-t border-slate-800/70 space-y-2">
                {wipeBanner && (
                  <p className="text-xs text-cyan-400">{wipeBanner}</p>
                )}
                <button
                  type="button"
                  onClick={handleResetTelemetryClick}
                  disabled={isWiping}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                    confirmWipe
                      ? "border-amber-500 bg-amber-500 text-black"
                      : "border-rose-900/50 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40"
                  }`}
                >
                  {isWiping ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Wiping Telemetry...</span>
                    </>
                  ) : confirmWipe ? (
                    <span>Click Again to Confirm Full DB Wipe</span>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Reset Telemetry &amp; Start Fresh</span>
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>
        </form>

        {/* Save Confirmation Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border bg-slate-900 px-3.5 py-2.5 text-xs font-semibold shadow-xl ${
                toast.variant === "synced"
                  ? "border-cyan-500/40 text-cyan-300"
                  : "border-amber-500/40 text-amber-300"
              }`}
            >
              {toast.variant === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
