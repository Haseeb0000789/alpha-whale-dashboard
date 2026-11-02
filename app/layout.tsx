// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { DashboardSocketProvider } from "@/context/DashboardSocketContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alpha Terminal | Spot & Order Book Trading Terminal",
  description:
    "Real-time cryptocurrency breakout signals, Smart Money Concepts, and whale bid wall tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-[#0B0E11] text-slate-100 antialiased selection:bg-white/20 selection:text-white`}
      >
        <DashboardSocketProvider>
          {/* Sticky Global Navigation Bar */}
          <Navbar />

          {/* Main Route View */}
          <div className="relative">{children}</div>
        </DashboardSocketProvider>
      </body>
    </html>
  );
}
