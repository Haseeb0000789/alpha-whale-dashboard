// components/Navbar.tsx
"use client";

import React, { useState, Suspense } from "react";
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
  Wifi,
  WifiOff,
} from "lucide-react";

const NAV_LINKS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Signals", href: "/signals", icon: Zap },
  { name: "Live Walls", href: "/walls", icon: Shield },
];

function NavbarContent() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, triggerRefresh } = useDashboardSocket();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#2B3139] bg-[#0B0E11]/95 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        {/* Brand Identity */}
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#1E2329]">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-tight text-white">
              Alpha Terminal
            </span>
            <span className="font-mono text-[10px] font-medium text-slate-500">
              v5.0
            </span>
          </div>
        </Link>

        {/* Desktop Links — Sleek Segmented Control */}
        <nav className="hidden items-center gap-0.5 rounded-lg border border-[#2B3139] bg-[#161A1E] p-0.5 md:flex">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  active ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeNavbarPill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-md bg-[#2B3139]"
                  />
                )}
                <Icon
                  className={`relative z-10 h-3.5 w-3.5 ${
                    active ? "text-emerald-400" : "text-slate-500"
                  }`}
                />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Live WebSocket Status + Control Center */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={triggerRefresh}
            title="Click to force instant WebSocket sync"
            className="hidden items-center gap-1.5 rounded-md border border-[#2B3139] bg-[#161A1E] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white lg:flex"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 animate-pulse text-amber-400" />
                <span>Syncing</span>
              </>
            )}
          </button>

          <Link
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
              pathname === "/settings"
                ? "border-slate-600 bg-[#2B3139] text-white"
                : "border-[#2B3139] bg-[#161A1E] text-slate-300 hover:border-slate-600 hover:text-white"
            }`}
          >
            <Settings className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Control Center</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2B3139] bg-[#161A1E] text-slate-300 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
            className="overflow-hidden border-t border-[#2B3139] bg-[#0B0E11] px-4 pb-3 pt-2 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold ${
                      active
                        ? "bg-[#2B3139] text-white"
                        : "text-slate-400 hover:bg-[#1E2329] hover:text-slate-200"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        active ? "text-emerald-400" : "text-slate-500"
                      }`}
                    />
                    <span>{item.name}</span>
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

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <div className="sticky top-0 z-40 h-12 w-full border-b border-[#2B3139] bg-[#0B0E11]/95" />
      }
    >
      <NavbarContent />
    </Suspense>
  );
}
