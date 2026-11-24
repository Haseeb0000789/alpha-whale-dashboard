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
  Zap,
  Crown,
} from "lucide-react";

const TELEGRAM_USERNAME = (
  process.env.NEXT_PUBLIC_TELEGRAM_USERNAME || "haseebahmad"
).replace(/^@/, "");

const TRIAL_TG_LINK = `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(
  "Assalam-o-Alaikum! I want the 7-Day VIP Trial Pass ($5 / PKR 1,500) for Alpha Terminal."
)}`;

const MONTHLY_TG_LINK = `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(
  "Assalam-o-Alaikum! I want the Monthly VIP Access ($15 / PKR 4,500) for Alpha Terminal."
)}`;

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
      setErrorMsg(
        "Invalid or expired access key. Contact us on Telegram to activate your VIP pass."
      );
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1200px] items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-xl border border-[#2B3139] bg-[#121418] p-5 sm:p-6 shadow-2xl">
        {/* Top Badge & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                Unlock Alpha Terminal VIP
              </h1>
              <p className="text-xs text-slate-400">
                Real-time 4-Pillar Signals, Main CEX Spot Setups &amp; L2 Whale Bid Walls
              </p>
            </div>
          </div>
          <span className="hidden rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 sm:inline-block">
            VIP Access Gate
          </span>
        </div>

        {/* 2-Column VIP Pricing Grid */}
        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Card 1: 7-Day Trial Pass */}
          <div className="flex flex-col justify-between rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4 transition hover:border-slate-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  <Zap className="h-3 w-3 text-amber-400" />
                  7-Day Trial Pass
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-400">
                  PKR 1,500
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-black text-white">
                  $5
                </span>
                <span className="text-xs text-slate-400">/ 7 days</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Test live terminal performance risk-free for 7 days
              </p>

              <ul className="mt-3 space-y-1.5 border-t border-[#2B3139] pt-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Full /signals (Binance Alpha + Main CEX Spot)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Full /walls (L2 Whale Bid Walls)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Real-time WebSocket stream</span>
                </li>
              </ul>
            </div>

            <a
              href={TRIAL_TG_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs font-bold text-white transition hover:border-slate-500 hover:bg-[#2B3139]"
            >
              <span>Get 7-Day Trial ($5)</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
            </a>
          </div>

          {/* Card 2: Monthly VIP Access (Highlighted) */}
          <div className="relative flex flex-col justify-between rounded-xl border border-emerald-500/50 bg-gradient-to-b from-emerald-500/[0.07] to-[#0B0E11] p-4 shadow-[0_0_25px_rgba(16,185,129,0.12)]">
            <span className="absolute -top-2.5 right-3 rounded-full border border-emerald-400/50 bg-emerald-500 px-2.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-slate-950">
              MOST POPULAR
            </span>

            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <Crown className="h-3 w-3 text-emerald-400" />
                  Monthly VIP Access
                </span>
                <span className="font-mono text-[11px] font-semibold text-emerald-300/90">
                  PKR 4,500
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-black text-white">
                  $15
                </span>
                <span className="text-xs text-slate-400">/mo (30 days)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-300">
                Complete institutional terminal + instant Telegram signals
              </p>

              <ul className="mt-3 space-y-1.5 border-t border-emerald-500/20 pt-3 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Everything in Trial for 30 days</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Private VIP Telegram Real-Time Alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Priority Entry &amp; SL/TP Tracking</span>
                </li>
              </ul>
            </div>

            <a
              href={MONTHLY_TG_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400"
            >
              <span>Get Monthly VIP ($15)</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Access Key Input Box */}
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-3 rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4"
        >
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Already have a VIP Key? Enter below to unlock
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="e.g. AW-7D-XXXXXX or AW-30D-XXXXXX"
                autoComplete="off"
                className="w-full rounded-lg border border-[#2B3139] bg-[#121418] py-2.5 pl-9 pr-3 font-mono text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Unlock VIP Terminal</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* Bottom Telegram Support & Back Link */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#2B3139] pt-3.5 text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Public Performance Overview</span>
          </Link>

          <a
            href={`https://t.me/${TELEGRAM_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            <span>Contact @{TELEGRAM_USERNAME} on Telegram</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
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
          Scanner thresholds, active strategy pattern gates, VIP key generation,
          and database telemetry resets are restricted to the system
          administrator. Entering the Admin Secret Key unlocks both the Control
          Center and all VIP Terminal views.
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
