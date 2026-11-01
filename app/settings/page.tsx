// app/settings/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  useDashboardSocket,
  BotSettings,
} from "@/context/DashboardSocketContext";
import {
  Settings,
  Sliders,
  ShieldCheck,
  Bell,
  Save,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  Cpu,
  Volume2,
  Sparkles,
} from "lucide-react";

export default function ControlCenterPage() {
  const { settings, saveBotSettings } = useDashboardSocket();

  // Local form state synced with global WebSocket/localStorage settings
  const [formData, setFormData] = useState<BotSettings>(settings);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Sync local form when global settings load, ONLY if user isn't actively editing
  useEffect(() => {
    if (!isDirty) {
      setFormData(settings);
    }
  }, [settings, isDirty]);

  const updateField = <K extends keyof BotSettings>(
    key: K,
    value: BotSettings[K]
  ) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = await saveBotSettings(formData);
    setIsSaving(false);
    setIsDirty(false);

    setToast(
      ok
        ? `✅ Settings Saved! Min Score (${formData.min_score}) synced with Scanner & Signals Grid.`
        : `⚡ Saved locally! Min Score (${formData.min_score}) active on Dashboard.`
    );
    setTimeout(() => setToast(null), 3500);
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
    };
    setFormData(recommended);
    setIsDirty(false);
    await saveBotSettings(recommended);
    setToast("🔄 Restored Recommended Institutional Defaults (Min Score: 65)");
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-4 sm:px-6 pb-20">
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
              Configure 4-Pillar scanner thresholds, L2 Bid Wall filters & global signal gates
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
        {/* Left Column (7 cols): Core Quantitative Thresholds */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                4-Pillar & Order Book Thresholds
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
                    Signals below this score are blocked in both Scanner & Signals Grid
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
        </div>

        {/* Right Column (5 cols): Smart Filters & Alert Pacing */}
        <div className="space-y-4 lg:col-span-5">
          {/* Strategy Protection Toggles */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl space-y-3.5">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Strategy Guards & SMC Engine
              </h2>
            </div>

            {/* Toggle 1: SMC */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-[#080B12]/90 p-3.5 transition hover:border-slate-700">
              <div className="pr-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span>Smart Money Concepts (BoS & Order Blocks)</span>
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
                  <span>Anti-Spoof & Dead-Cat Bounce Filter</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Penalizes coins with &lt;45% wall respect rate or weak taker buy flow
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
                Alert Pacing & Cooldown
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
        </div>
      </form>

      {/* Save Confirmation Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-[#0B0F19]/95 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-xl"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}