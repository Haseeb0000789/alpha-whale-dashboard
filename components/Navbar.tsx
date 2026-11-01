// components/Navbar.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardSocket } from "@/context/DashboardSocketContext";
import {
  Activity,
  LayoutDashboard,
  Zap,
  Shield,
  Settings,
  Menu,
  X,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

const NAV_LINKS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, badge: "Overview" },
  { name: "Signals", href: "/signals", icon: Zap, badge: "4-Pillar" },
  { name: "Live Walls", href: "/walls", icon: Shield, badge: "L2 Radar" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, triggerRefresh } = useDashboardSocket();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#07090E]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 focus:outline-none"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-600/20 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                Alpha Whale{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Scanner
                </span>
              </span>
              <span className="hidden items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 sm:inline-flex">
                <Sparkles className="h-2.5 w-2.5" /> v5.0
              </span>
            </div>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              Institutional 4-Pillar Spot & Order Book Terminal
            </p>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#0B0F17]/90 p-1.5 md:flex">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  active
                    ? "text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeNavbarPill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                  />
                )}
                <Icon
                  className={`relative z-10 h-4 w-4 ${
                    active ? "text-cyan-400" : "text-slate-400"
                  }`}
                />
                <span className="relative z-10">{item.name}</span>
                <span
                  className={`relative z-10 rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-white/[0.04] text-slate-500"
                  }`}
                >
                  {item.badge}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: WebSocket Status + Control Center */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            title="Click to force instant WebSocket sync"
            className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition lg:flex ${
              isConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span>WS LiveStream</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 animate-pulse text-amber-400" />
                <span>Reconnecting WS...</span>
              </>
            )}
          </button>

          <Link
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              pathname === "/settings"
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300"
            }`}
          >
            <Settings className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Control Center</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-cyan-400" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-800/80 bg-[#090D15]/95 px-4 pb-4 pt-2 md:hidden"
          >
            <div className="flex flex-col gap-1.5">
              {NAV_LINKS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
                      active
                        ? "border-cyan-500/40 bg-cyan-500/15 text-white"
                        : "border-transparent bg-white/[0.02] text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-cyan-400" />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-cyan-300">{item.badge}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}