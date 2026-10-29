// components/Skeletons.tsx
"use client";

import React from "react";

export function SignalTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr
          key={idx}
          className="animate-pulse border-b border-white/[0.04] bg-white/[0.01]"
        >
          {/* Symbol & Timestamp */}
          <td className="py-4 pl-6 pr-3">
            <div className="space-y-2">
              <div className="h-4 w-16 rounded-md bg-slate-800/90" />
              <div className="h-2.5 w-12 rounded bg-slate-800/60" />
            </div>
          </td>

          {/* Pattern & SMC Badges */}
          <td className="px-3 py-4">
            <div className="space-y-2">
              <div className="h-3.5 w-28 rounded-md bg-slate-800/90" />
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-12 rounded bg-slate-800/70" />
                <div className="h-4 w-10 rounded bg-purple-900/30" />
                <div className="h-4 w-10 rounded bg-emerald-900/30" />
              </div>
            </div>
          </td>

          {/* Timeframe Badge */}
          <td className="px-3 py-4">
            <div className="h-6 w-10 rounded-lg bg-slate-800/80" />
          </td>

          {/* 4-Pillar Score Progress Bar */}
          <td className="px-3 py-4">
            <div className="w-32 space-y-2">
              <div className="flex justify-between">
                <div className="h-3.5 w-12 rounded bg-slate-800/90" />
                <div className="h-3 w-8 rounded bg-cyan-900/40" />
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800/80" />
            </div>
          </td>

          {/* Entry Zone */}
          <td className="px-3 py-4">
            <div className="h-4 w-24 rounded bg-slate-800/80" />
          </td>

          {/* Stop Loss */}
          <td className="px-3 py-4">
            <div className="h-4 w-16 rounded bg-rose-950/50" />
          </td>

          {/* TP1 */}
          <td className="px-3 py-4">
            <div className="h-4 w-16 rounded bg-emerald-950/50" />
          </td>

          {/* Status Pill */}
          <td className="px-3 py-4">
            <div className="h-6 w-24 rounded-full bg-slate-800/80" />
          </td>

          {/* Action Buttons */}
          <td className="py-4 pl-2 pr-6 text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="h-7 w-7 rounded-lg bg-rose-950/40" />
              <div className="h-7 w-20 rounded-lg bg-slate-800/80" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function WallCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          {/* Top Row: Dot, Symbol, Exchange, Badge, Trash Icon */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-800/60" />
              <div className="h-4 w-20 rounded-md bg-slate-800/90" />
              <div className="h-4 w-16 rounded bg-slate-800/70" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 rounded-full bg-emerald-950/60" />
              <div className="h-7 w-7 rounded-lg bg-rose-950/40" />
            </div>
          </div>

          {/* Middle Box: USD Depth & Order Book Price */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.04] bg-black/30 px-3.5 py-2.5">
            <div className="space-y-1.5">
              <div className="h-2.5 w-20 rounded bg-slate-800/70" />
              <div className="h-5 w-24 rounded bg-slate-800/90" />
            </div>
            <div className="space-y-1.5 text-right">
              <div className="ml-auto h-2.5 w-20 rounded bg-slate-800/70" />
              <div className="ml-auto h-4 w-20 rounded bg-cyan-950/60" />
            </div>
          </div>

          {/* Bottom Row: Respect Rate Progress Bar */}
          <div className="mt-3 space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-36 rounded bg-slate-800/80" />
              <div className="h-3 w-12 rounded bg-slate-800/60" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800/80" />
          </div>
        </div>
      ))}
    </div>
  );
}