// app/settings/page.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  useDashboardSocket,
  BotSettings,
  ALL_TIMEFRAMES,
  ALL_PATTERNS,
} from "@/context/DashboardSocketContext";
import { formatPatternName } from "@/types/types";
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
} from "lucide-react";

const SPOT_QUANT_PATTERNS = new Set([
  "vwap_ema_pullback",
  "liquidity_sweep_breakout",
  "order_block_bounce",
  "institutional_reaccumulation",
]);

export default function ControlCenterPage() {
  const { settings, saveBotSettings, resetTelemetryData } = useDashboardSocket();

  // Local form draft overlaid on global WebSocket/localStorage settings
  const [draft, setDraft] = useState<Partial<BotSettings> | null>(null);
  const formData: BotSettings = useMemo(() => {
    const merged = draft ? { ...settings, ...draft } : settings;
    return {
      ...merged,
      enabled_timeframes: Array.isArray(merged.enabled_timeframes)
        ? merged.enabled_timeframes
        : [...ALL_TIMEFRAMES],
      enabled_patterns: Array.isArray(merged.enabled_patterns)
        ? merged.enabled_patterns
        : [...ALL_PATTERNS],
    };
  }, [settings, draft]);

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

  const showToast = (message: string, variant: "synced" | "local") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
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
    setDraft(null);
    const ok = await saveBotSettings(recommended);
    showToast(
      ok
        ? "Restored Recommended Institutional Defaults (Min Score: 65)"
        : "Restored Recommended Defaults locally (Backend offline)",
      ok ? "synced" : "local"
    );
  };

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-4 sm:px-6 pb-24">
      {/* Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/70 px-5 py-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
                Bot Control Center
              </h1>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                Live Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Configure 4-Pillar scanner thresholds, L2 Bid Wall filters &amp; active strategy gates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-800/60 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Recommended (65)</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition hover:brightness-110 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Left Column (7 cols): Core Quantitative Thresholds + Active Strategy Filters */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                4-Pillar &amp; Order Book Thresholds
              </h2>
            </div>

            {/* 1. Minimum 4-Pillar Score Slider */}
            <div className="rounded-xl border border-slate-800 bg-[#080B12]/90 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white">
                    Minimum 4-Pillar Signal Score (Global Gate)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Signals below this score are blocked in both Scanner &amp; Signals Grid
                  </p>
                </div>
                <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 font-mono text-base font-black text-cyan-300">
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
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
              />
              <div className="flex justify-between font-mono text-[10px] text-slate-500">
                <span>40 (Loose)</span>
                <span>55 (Default)</span>
                <span className="text-emerald-400 font-bold">
                  65–70 (Recommended Institutional)
                </span>
                <span>90 (Strict)</span>
              </div>
            </div>

            {/* 2. Minimum Bid Wall Size (USD) */}
            <div className="rounded-xl border border-slate-800 bg-[#080B12]/90 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white">
                    Minimum Whale Bid Wall Size (USD)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Minimum L2 order book cluster required to trigger wall tracking
                  </p>
                </div>
                <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-base font-black text-emerald-300">
                  ${formData.min_wall_usd.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={2000}
                max={50000}
                step={1000}
                value={formData.min_wall_usd}
                onChange={(e) =>
                  updateField("min_wall_usd", Number(e.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
              />
              <div className="flex justify-between font-mono text-[10px] text-slate-500">
                <span>$2,000</span>
                <span>$5,000</span>
                <span>$15,000</span>
                <span>$50,000</span>
              </div>
            </div>

            {/* 3. Wall Proximity Percentage */}
            <div className="rounded-xl border border-slate-800 bg-[#080B12]/90 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white">
                    Max Bid Wall Distance from Price (%)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Only count bid walls sitting within this % below current mid-price
                  </p>
                </div>
                <span className="rounded-lg border border-purple-500/40 bg-purple-500/15 px-3 py-1 font-mono text-base font-black text-purple-300">
                  -{formData.proximity_pct.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={4.0}
                step={0.1}
                value={formData.proximity_pct}
                onChange={(e) =>
                  updateField("proximity_pct", Number(e.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-400"
              />
              <div className="flex justify-between font-mono text-[10px] text-slate-500">
                <span>0.3% (Scalp)</span>
                <span>1.5% (Optimal)</span>
                <span>4.0% (Wide)</span>
              </div>
            </div>
          </div>

          {/* Active Strategy Filters Section */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Filter className="h-4 w-4 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Active Strategy Filters
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Disabled timeframes &amp; patterns are skipped by Alpha &amp; Spot scanners, DB, Telegram, and WebSockets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnableAllStrategies}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Enable All
              </button>
            </div>

            {/* Timeframes Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Enabled Timeframes</span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-cyan-300">
                  {formData.enabled_timeframes.length} / {ALL_TIMEFRAMES.length} Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {ALL_TIMEFRAMES.map((tf) => {
                  const checked = formData.enabled_timeframes.includes(tf);
                  return (
                    <label
                      key={tf}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 transition ${
                        checked
                          ? "border-cyan-500/50 bg-cyan-500/15 text-white shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                          : "border-slate-800 bg-[#080B12]/70 text-slate-500 hover:border-slate-700"
                      }`}
                    >
                      <span className="font-mono text-xs font-black uppercase">
                        {tf}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleTimeframe(tf)}
                        className="h-4 w-4 rounded accent-cyan-400"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Patterns Grid */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Enabled Chart &amp; Quant Patterns (Alpha + Spot)</span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-emerald-300">
                  {formData.enabled_patterns.length} / {ALL_PATTERNS.length} Active
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ALL_PATTERNS.map((pattern) => {
                  const checked = formData.enabled_patterns.includes(pattern);
                  const isSpotQuant = SPOT_QUANT_PATTERNS.has(pattern);
                  return (
                    <label
                      key={pattern}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition ${
                        checked
                          ? "border-emerald-500/45 bg-emerald-500/10 text-white"
                          : "border-slate-800 bg-[#080B12]/70 text-slate-500 hover:border-slate-700"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold">
                            {formatPatternName(pattern)}
                          </span>
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${
                              isSpotQuant
                                ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
                                : "border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                            }`}
                          >
                            {isSpotQuant ? "Spot" : "Alpha"}
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleTogglePattern(pattern)}
                        className="h-4 w-4 shrink-0 rounded accent-emerald-400"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Smart Filters & Alert Pacing */}
        <div className="space-y-4 lg:col-span-5">
          {/* Strategy Protection Toggles */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl space-y-3.5">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Strategy Guards &amp; SMC Engine
              </h2>
            </div>

            {/* Toggle 1: SMC */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5 transition hover:border-slate-700">
              <div className="pr-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span>Smart Money Concepts (BoS &amp; Order Blocks)</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Boosts Pillar-3 score when institutional Break of Structure aligns
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.enable_smc}
                onChange={(e) => updateField("enable_smc", e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-400"
              />
            </label>

            {/* Toggle 2: Dead-Cat Bounce Filter */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5 transition hover:border-slate-700">
              <div className="pr-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Anti-Spoof &amp; Dead-Cat Bounce Filter</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Penalizes coins with &lt;45% wall respect rate or dumped macro structure
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.enable_dead_cat}
                onChange={(e) =>
                  updateField("enable_dead_cat", e.target.checked)
                }
                className="h-4 w-4 rounded accent-emerald-400"
              />
            </label>

            {/* Toggle 3: Extension Penalty */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5 transition hover:border-slate-700">
              <div className="pr-3">
                <span className="block text-xs font-bold text-white">
                  Over-Extension Guard (&gt;5% Above Neckline)
                </span>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Marks pumped breakouts as &ldquo;Wait for Retest&rdquo; to prevent top-buying
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.enable_extension_penalty}
                onChange={(e) =>
                  updateField("enable_extension_penalty", e.target.checked)
                }
                className="h-4 w-4 rounded accent-emerald-400"
              />
            </label>

            {/* Toggle 4: Audio Alerts */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5 transition hover:border-slate-700">
              <div className="pr-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>Terminal Audio Ping on High-Score Signal</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Plays subtle institutional sonar chime when 75+ signal arrives
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.enable_audio}
                onChange={(e) => updateField("enable_audio", e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-400"
              />
            </label>
          </div>

          {/* Cooldown & Cycle Pacing */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl space-y-3.5">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <Bell className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Alert Pacing &amp; Cooldown
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5">
                <label className="block text-[11px] font-bold text-slate-300">
                  Re-Alert Cooldown (Mins)
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={formData.cooldown_minutes}
                  onChange={(e) =>
                    updateField("cooldown_minutes", Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5">
                <label className="block text-[11px] font-bold text-slate-300">
                  Max Alerts / Scan Cycle
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={formData.max_alerts_per_cycle}
                  onChange={(e) =>
                    updateField("max_alerts_per_cycle", Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Telemetry & Database Reset */}
          <div className="rounded-2xl border border-rose-500/30 bg-slate-900/60 p-5 backdrop-blur-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="h-4 w-4 text-rose-400" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Telemetry &amp; Database Reset
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Wipe historical Alpha signals, outcomes &amp; Spot state to evaluate new strategy filters from 0
                  </p>
                </div>
              </div>
            </div>

            {wipeBanner && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-bold text-emerald-300">
                {wipeBanner}
              </div>
            )}

            <button
              type="button"
              onClick={handleResetTelemetryClick}
              disabled={isWiping}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:opacity-60 ${
                confirmWipe
                  ? "border-amber-400/70 bg-amber-500/20 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:bg-amber-500/30"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-300 hover:border-rose-400/60 hover:bg-rose-500/25 hover:text-white"
              }`}
            >
              {isWiping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-rose-300" />
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
            </button>
          </div>
        </div>
      </form>

      {/* Save Confirmation Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border bg-[#0B0F19]/95 px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-xl ${
              toast.variant === "synced"
                ? "border-emerald-500/40 text-emerald-300"
                : "border-amber-500/40 text-amber-300"
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
  );
}
