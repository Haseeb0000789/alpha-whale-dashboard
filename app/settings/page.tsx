// app/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Save,
  RotateCcw,
  Shield,
  Volume2,
  Sliders,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowLeft,
  Loader2,
  Sparkles,
  Flame,
  Radar,
  TrendingDown,
  Bell,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Exact JSON payload interface required by FastAPI /api/settings
export interface BotSettingsPayload {
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

export const DEFAULT_BOT_SETTINGS: BotSettingsPayload = {
  min_score: 55,
  min_wall_usd: 5000,
  proximity_pct: 1.5,
  enable_dead_cat: true,
  enable_smc: true,
  enable_extension_penalty: true,
  enable_audio: true,
  cooldown_minutes: 30,
  max_alerts_per_cycle: 5,
};

type SaveState = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Sub-Component: Interactive Hover Tooltip
// ---------------------------------------------------------------------------
function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-flex items-center">
      <Info className="h-3.5 w-3.5 cursor-help text-slate-500 transition hover:text-cyan-400" />
      <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 scale-95 rounded-xl border border-white/15 bg-[#0B101B]/95 p-2.5 text-[11px] font-normal leading-relaxed text-slate-200 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
        {text}
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/15 bg-[#0B101B]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Component: Custom Framer Motion Neon Switch
// ---------------------------------------------------------------------------
interface PremiumSwitchProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor?: "emerald" | "cyan" | "purple" | "amber";
}

function PremiumSwitch({
  enabled,
  onChange,
  title,
  description,
  icon: Icon,
  accentColor = "emerald",
}: PremiumSwitchProps) {
  const accentMap = {
    emerald: {
      iconBox: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      trackActive: "bg-gradient-to-r from-emerald-500 to-teal-400 border-emerald-400/50 shadow-[0_0_18px_rgba(16,185,129,0.35)]",
      badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    },
    cyan: {
      iconBox: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
      trackActive: "bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400/50 shadow-[0_0_18px_rgba(6,182,212,0.35)]",
      badge: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
    },
    purple: {
      iconBox: "border-purple-500/30 bg-purple-500/10 text-purple-400",
      trackActive: "bg-gradient-to-r from-purple-500 to-indigo-500 border-purple-400/50 shadow-[0_0_18px_rgba(168,85,247,0.35)]",
      badge: "border-purple-500/30 bg-purple-500/15 text-purple-300",
    },
    amber: {
      iconBox: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      trackActive: "bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400/50 shadow-[0_0_18px_rgba(245,158,11,0.35)]",
      badge: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    },
  }[accentColor];

  return (
    <div
      onClick={() => onChange(!enabled)}
      className={`group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
        enabled
          ? "border-white/[0.12] bg-white/[0.03] hover:border-white/20"
          : "border-white/[0.05] bg-black/20 opacity-75 hover:opacity-100"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
            enabled
              ? accentMap.iconBox
              : "border-white/10 bg-white/[0.03] text-slate-500"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                enabled
                  ? accentMap.badge
                  : "border-white/10 bg-white/[0.04] text-slate-500"
              }`}
            >
              {enabled ? "ON" : "OFF"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>

      {/* Animated Switch Track */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!enabled);
        }}
        className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border p-1 transition-colors duration-200 focus:outline-none ${
          enabled
            ? accentMap.trackActive
            : "border-white/10 bg-slate-800/90"
        }`}
        style={{ width: "52px" }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-md ${
            enabled ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component: Bot Control Center
// ---------------------------------------------------------------------------
export default function BotControlCenterPage() {
  const [settings, setSettings] = useState<BotSettingsPayload>(DEFAULT_BOT_SETTINGS);
  const [savedSnapshot, setSavedSnapshot] = useState<BotSettingsPayload>(DEFAULT_BOT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Fetch current settings on mount from GET /api/settings
  const fetchCurrentSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const data = await res.json();
      const merged: BotSettingsPayload = {
        min_score: Number(data.min_score ?? DEFAULT_BOT_SETTINGS.min_score),
        min_wall_usd: Number(data.min_wall_usd ?? DEFAULT_BOT_SETTINGS.min_wall_usd),
        proximity_pct: Number(data.proximity_pct ?? DEFAULT_BOT_SETTINGS.proximity_pct),
        enable_dead_cat: Boolean(data.enable_dead_cat ?? DEFAULT_BOT_SETTINGS.enable_dead_cat),
        enable_smc: Boolean(data.enable_smc ?? DEFAULT_BOT_SETTINGS.enable_smc),
        enable_extension_penalty: Boolean(
          data.enable_extension_penalty ?? DEFAULT_BOT_SETTINGS.enable_extension_penalty
        ),
        enable_audio: Boolean(data.enable_audio ?? DEFAULT_BOT_SETTINGS.enable_audio),
        cooldown_minutes: Number(data.cooldown_minutes ?? DEFAULT_BOT_SETTINGS.cooldown_minutes),
        max_alerts_per_cycle: Number(
          data.max_alerts_per_cycle ?? DEFAULT_BOT_SETTINGS.max_alerts_per_cycle
        ),
      };
      setSettings(merged);
      setSavedSnapshot(merged);
    } catch {
      // Fallback to localStorage or defaults if FastAPI endpoint isn't reachable yet
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("alpha_whale_bot_settings");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setSettings({ ...DEFAULT_BOT_SETTINGS, ...parsed });
            setSavedSnapshot({ ...DEFAULT_BOT_SETTINGS, ...parsed });
          } catch {
            setSettings(DEFAULT_BOT_SETTINGS);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentSettings();
  }, [fetchCurrentSettings]);

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedSnapshot);
  }, [settings, savedSnapshot]);

  // Save Configuration -> POST /api/settings
  const handleSaveConfiguration = async () => {
    setSaveState("saving");
    try {
      // Persist to localStorage as well so audio preferences sync across tabs
      if (typeof window !== "undefined") {
        localStorage.setItem("alpha_whale_bot_settings", JSON.stringify(settings));
      }

      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      setSavedSnapshot(settings);
      setSaveState("saved");
      showToast("success", "Settings Saved Successfully");
      setTimeout(() => setSaveState("idle"), 2200);
    } catch {
      setSaveState("error");
      showToast("error", "Error saving settings to FastAPI backend");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    setSettings(DEFAULT_BOT_SETTINGS);
    showToast("success", "Reset to default values — click Save Configuration to apply");
  };

  // Percentage fill helper for range sliders
  const getPctFill = (val: number, min: number, max: number) =>
    Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));

  return (
    <div className="min-h-screen bg-[#07090E] pb-28 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Ambient Neon Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/[0.06] blur-[140px]" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-cyan-500/[0.06] blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-purple-500/[0.05] blur-[140px]" />
      </div>

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07090E]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300"
              title="Back to Live Trading Terminal"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-600/20 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                <Settings className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Bot Control{" "}
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                      Center
                    </span>
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                    <Sparkles className="h-3 w-3" /> Real-Time Engine
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Configure your Alpha Whale Scanner in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Top-Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saveState === "saving"}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span>Reset to Defaults</span>
            </button>

            {/* Animated Save Configuration Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveConfiguration}
              disabled={saveState === "saving"}
              className={`relative inline-flex min-w-[175px] items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-bold transition-all ${
                saveState === "saved"
                  ? "border-emerald-400 bg-emerald-500 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                  : saveState === "error"
                  ? "border-rose-500/60 bg-rose-500/20 text-rose-200"
                  : "border-emerald-500/50 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:brightness-110"
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {saveState === "saving" ? (
                  <motion.span
                    key="saving"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Syncing Engine...</span>
                  </motion.span>
                ) : saveState === "saved" ? (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Configuration Saved!</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Configuration</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative mx-auto max-w-[1320px] space-y-6 px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="h-[460px] animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/50 lg:col-span-7" />
            <div className="h-[460px] animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/50 lg:col-span-5" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN: Section 1 (Signal Thresholds) & Section 3 (Advanced Mechanics) */}
            <div className="space-y-6 lg:col-span-7">
              {/* SECTION 1: SIGNAL THRESHOLDS (SLIDERS) */}
              <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/85 to-[#0B0F17]/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                      <Sliders className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        1. Signal & Order Book Thresholds
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Fine-tune 4-Pillar sensitivity and L2 Bid Wall whale detection filters
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                    Live Sliders
                  </span>
                </div>

                <div className="space-y-7">
                  {/* Slider 1: Minimum Signal Score (0 - 100) */}
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="min-score-slider"
                          className="text-xs font-bold text-white"
                        >
                          Minimum Signal Score (0–100)
                        </label>
                        <InfoTooltip text="Only send alerts if the 4-Pillar score is above this." />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-3 py-1 font-mono text-sm font-black text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                          {settings.min_score} / 100
                        </span>
                      </div>
                    </div>

                    <div className="relative mt-4 flex items-center">
                      <input
                        id="min-score-slider"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.min_score}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            min_score: Number(e.target.value),
                          }))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
                        style={{
                          background: `linear-gradient(to right, #06b6d4 ${getPctFill(
                            settings.min_score,
                            0,
                            100
                          )}%, #1e293b ${getPctFill(settings.min_score, 0, 100)}%)`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>0 (All Signals)</span>
                      <div className="flex gap-1.5">
                        {[50, 55, 65, 75, 85].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({ ...prev, min_score: preset }))
                            }
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                              settings.min_score === preset
                                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
                                : "bg-white/[0.04] text-slate-400 hover:text-white"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <span>100 (Strict Institutional)</span>
                    </div>
                  </div>

                  {/* Slider 2: Minimum Bid Wall Size ($) ($1,000 - $100,000) */}
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="min-wall-slider"
                          className="text-xs font-bold text-white"
                        >
                          Minimum Bid Wall Size ($)
                        </label>
                        <InfoTooltip text="Ignore order book walls smaller than this." />
                      </div>
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 font-mono text-sm font-black text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        ${settings.min_wall_usd.toLocaleString("en-US")}
                      </span>
                    </div>

                    <div className="relative mt-4 flex items-center">
                      <input
                        id="min-wall-slider"
                        type="range"
                        min={1000}
                        max={100000}
                        step={500}
                        value={settings.min_wall_usd}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            min_wall_usd: Number(e.target.value),
                          }))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
                        style={{
                          background: `linear-gradient(to right, #10b981 ${getPctFill(
                            settings.min_wall_usd,
                            1000,
                            100000
                          )}%, #1e293b ${getPctFill(
                            settings.min_wall_usd,
                            1000,
                            100000
                          )}%)`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>$1,000 (Micro-Cap)</span>
                      <div className="flex gap-1.5">
                        {[3000, 5000, 10000, 25000, 50000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({ ...prev, min_wall_usd: preset }))
                            }
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                              settings.min_wall_usd === preset
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                                : "bg-white/[0.04] text-slate-400 hover:text-white"
                            }`}
                          >
                            ${preset / 1000}k
                          </button>
                        ))}
                      </div>
                      <span>$100,000 (Mega Whale)</span>
                    </div>
                  </div>

                  {/* Slider 3: Proximity to Price (%) (0.5% - 5.0%) */}
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="proximity-slider"
                          className="text-xs font-bold text-white"
                        >
                          Proximity to Price (%)
                        </label>
                        <InfoTooltip text="Only show walls within this distance from the current price." />
                      </div>
                      <span className="rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-1 font-mono text-sm font-black text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                        {settings.proximity_pct.toFixed(1)}%
                      </span>
                    </div>

                    <div className="relative mt-4 flex items-center">
                      <input
                        id="proximity-slider"
                        type="range"
                        min={0.5}
                        max={5.0}
                        step={0.1}
                        value={settings.proximity_pct}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            proximity_pct: parseFloat(e.target.value),
                          }))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-400"
                        style={{
                          background: `linear-gradient(to right, #a855f7 ${getPctFill(
                            settings.proximity_pct,
                            0.5,
                            5.0
                          )}%, #1e293b ${getPctFill(settings.proximity_pct, 0.5, 5.0)}%)`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>0.5% (Immediate Touch)</span>
                      <div className="flex gap-1.5">
                        {[1.0, 1.5, 2.0, 3.0, 4.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({ ...prev, proximity_pct: preset }))
                            }
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                              settings.proximity_pct === preset
                                ? "bg-purple-500/25 text-purple-300 border border-purple-500/40"
                                : "bg-white/[0.04] text-slate-400 hover:text-white"
                            }`}
                          >
                            {preset.toFixed(1)}%
                          </button>
                        ))}
                      </div>
                      <span>5.0% (Deep Book)</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 3: ADVANCED MECHANICS (NUMBER INPUTS) */}
              <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/85 to-[#0B0F17]/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        3. Advanced Anti-Spam & Cycle Mechanics
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Control Telegram notification rate-limiting and per-token alert cooldowns
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Number Input 1: Alert Cooldown (Minutes) */}
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="cooldown-input"
                          className="text-xs font-bold text-white"
                        >
                          Alert Cooldown (Minutes)
                        </label>
                        <InfoTooltip text="Wait time before sending another alert for the same coin." />
                      </div>
                      <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Wait time before re-alerting the same symbol
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        id="cooldown-input"
                        type="number"
                        min={1}
                        max={720}
                        value={settings.cooldown_minutes}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            cooldown_minutes: Math.max(1, parseInt(e.target.value || "1", 10)),
                          }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#07090E] px-3.5 py-2.5 font-mono text-sm font-bold text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      />
                      <span className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-xs text-slate-400">
                        mins
                      </span>
                    </div>
                  </div>

                  {/* Number Input 2: Max Alerts per Cycle */}
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="max-alerts-input"
                          className="text-xs font-bold text-white"
                        >
                          Max Alerts per Cycle
                        </label>
                        <InfoTooltip text="Prevents spamming your Telegram." />
                      </div>
                      <Bell className="h-4 w-4 text-cyan-400" />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Highest-scoring alerts dispatched per scan tick
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        id="max-alerts-input"
                        type="number"
                        min={1}
                        max={50}
                        value={settings.max_alerts_per_cycle}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            max_alerts_per_cycle: Math.max(
                              1,
                              Math.min(50, parseInt(e.target.value || "1", 10))
                            ),
                          }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#07090E] px-3.5 py-2.5 font-mono text-sm font-bold text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                      />
                      <span className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-xs text-slate-400">
                        alerts
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Section 2 (Feature Toggles) & Live Payload Inspector */}
            <div className="space-y-6 lg:col-span-5">
              {/* SECTION 2: FEATURE TOGGLES (SWITCH COMPONENTS) */}
              <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/85 to-[#0B0F17]/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        2. Strategy Guards & Feature Toggles
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Enable or disable real-time algorithmic protection layers
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <PremiumSwitch
                    enabled={settings.enable_dead_cat}
                    onChange={(val) =>
                      setSettings((prev) => ({ ...prev, enable_dead_cat: val }))
                    }
                    title="Dead Cat Filter"
                    description="If ON, ignores coins with zero organic volume or severe 5m waterfall dumps (≤ -15%)."
                    icon={TrendingDown}
                    accentColor="emerald"
                  />

                  <PremiumSwitch
                    enabled={settings.enable_smc}
                    onChange={(val) =>
                      setSettings((prev) => ({ ...prev, enable_smc: val }))
                    }
                    title="SMC Confluence"
                    description="If ON, requires Smart Money Concepts (Break of Structure & Order Block) for signal scoring."
                    icon={Cpu}
                    accentColor="purple"
                  />

                  <PremiumSwitch
                    enabled={settings.enable_extension_penalty}
                    onChange={(val) =>
                      setSettings((prev) => ({
                        ...prev,
                        enable_extension_penalty: val,
                      }))
                    }
                    title="Extension Penalty"
                    description="If ON, reduces the score of overextended coins that have already pumped >5% above neckline."
                    icon={Flame}
                    accentColor="amber"
                  />

                  <PremiumSwitch
                    enabled={settings.enable_audio}
                    onChange={(val) =>
                      setSettings((prev) => ({ ...prev, enable_audio: val }))
                    }
                    title="Dashboard Audio Alerts"
                    description="If ON, plays a sonar audio chime in your browser whenever a new 4-Pillar signal arrives."
                    icon={Volume2}
                    accentColor="cyan"
                  />
                </div>
              </section>

              {/* LIVE PAYLOAD PREVIEW CARD */}
              <section className="rounded-2xl border border-white/[0.08] bg-[#090D15]/90 p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Radar className="h-4 w-4 text-cyan-400" />
                    <span>Live FastAPI Payload Preview</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400">
                    POST /api/settings
                  </span>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#05070B] p-3.5 font-mono text-[11px] leading-relaxed text-cyan-300">
                  {JSON.stringify(settings, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Sticky Action Bar (Shows Unsaved Changes Status + Save & Reset Buttons) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#080B12]/90 px-6 py-3.5 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs">
            {hasUnsavedChanges ? (
              <>
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                <span className="font-semibold text-amber-300">
                  You have unsaved configuration changes
                </span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className=" text-slate-400">
                  All settings synchronized with FastAPI scanner engine
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveConfiguration}
              disabled={saveState === "saving"}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:brightness-110 disabled:opacity-50"
            >
              {saveState === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Animated Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="settings-toast"
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className={`fixed bottom-20 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-xs font-bold shadow-2xl backdrop-blur-xl ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-[#0B1218]/95 text-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
                : "border-rose-500/40 bg-[#160B11]/95 text-rose-300 shadow-[0_0_35px_rgba(244,63,94,0.25)]"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            )}
            <div>
              <p className="text-xs font-bold text-white">{toast.message}</p>
              <p className="text-[10px] font-normal text-slate-400">
                {toast.type === "success"
                  ? "ScannerWorker & BreakoutConfig updated live"
                  : "Check that FastAPI is running on port 8000"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}