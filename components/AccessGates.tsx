// components/AccessGates.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  ArrowUpRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function VipAccessGate({ children }: { children: React.ReactNode }) {
  const { authRole, verifyAccessKey } = useDashboardSocket();
  const [inputKey, setInputKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (authRole === "vip" || authRole === "admin") {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a valid VIP or Admin access key.");
      return;
    }
    setIsVerifying(true);
    setErrorMsg(null);
    const role = await verifyAccessKey(trimmed);
    setIsVerifying(false);
    if (!role) {
      setErrorMsg("Invalid access key. Contact support on Telegram for VIP credentials.");
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-[1600px] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-[#2B3139] bg-[#121418] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Lock className="h-5 w-5" />
          </div>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
            VIP Terminal Locked
          </span>
        </div>

        <h1 className="mt-4 text-lg font-extrabold tracking-tight text-white">
          Unlock Live Signals &amp; L2 Whale Radar
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Public visitors can audit our verified 7-day win rate on the Overview
          dashboard. Real-time breakout setups, Main CEX Spot signals, and L2
          order book whale walls require an active VIP Access Key.
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-[#2B3139] bg-[#0B0E11] p-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Live 4-Pillar Binance Alpha &amp; Main CEX Spot Setups</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Multi-Exchange L2 Bid Walls &amp; Cumulative Depth Curves</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Exact Entry, Stop Loss, TP1/TP2 &amp; Breakeven Tracking</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              VIP Access Key
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter your VIP or Admin access key..."
                autoComplete="off"
                className="w-full rounded-lg border border-[#2B3139] bg-[#0B0E11] py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying Key...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Unlock VIP Terminal</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 border-t border-[#2B3139] pt-4">
          <a
            href="https://t.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2B3139] bg-[#1E2329] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white"
          >
            <span>Get VIP Access Key (Telegram)</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
          </a>

          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Public Performance Overview</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

export function AdminPinGate({ children }: { children: React.ReactNode }) {
  const { authRole, verifyAccessKey } = useDashboardSocket();
  const [inputKey, setInputKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (authRole === "admin") {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setErrorMsg("Please enter the Admin Secret Key.");
      return;
    }
    setIsVerifying(true);
    setErrorMsg(null);
    const role = await verifyAccessKey(trimmed);
    setIsVerifying(false);
    if (role === "vip") {
      setErrorMsg(
        "VIP Key verified for Signals & Walls, but Bot Control Center requires the Admin Secret Key."
      );
    } else if (!role) {
      setErrorMsg("Invalid Admin Secret Key.");
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-[1600px] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-[#2B3139] bg-[#121418] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400">
            <Lock className="h-5 w-5" />
          </div>
          <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
            Admin Restricted
          </span>
        </div>

        <h1 className="mt-4 text-lg font-extrabold tracking-tight text-white">
          Bot Control Center Authorization
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Scanner thresholds, active strategy pattern gates, and database
          telemetry resets are restricted to the system administrator. Entering
          the Admin Secret Key unlocks both the Control Center and all VIP
          Terminal views.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Admin Secret Key
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter Admin Secret Key..."
                autoComplete="off"
                className="w-full rounded-lg border border-[#2B3139] bg-[#0B0E11] py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying Admin Key...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Unlock Control Center</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 border-t border-[#2B3139] pt-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Public Performance Overview</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
