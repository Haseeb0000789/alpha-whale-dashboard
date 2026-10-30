// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react"; // <--- YEH NAYA IMPORT ADD KAREIN
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alpha Whale Scanner | 4-Pillar Spot & L2 Order Book Terminal",
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
        className={`${inter.className} min-h-screen bg-[#07090E] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200`}
      >
        {/* Global Ambient Neon Background Glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/[0.05] blur-[140px]" />
          <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-cyan-500/[0.05] blur-[140px]" />
        </div>

        {/* Sticky Global Navigation Bar with Suspense */}
        <Suspense 
          fallback={
            // Yeh ek dummy navbar hai jo load hote waqt dikhega taake screen na hile
            <div className="sticky top-0 z-40 h-16 w-full border-b border-slate-800 bg-[#07090E]/85 backdrop-blur-xl" />
          }
        >
          <Navbar />
        </Suspense>

        {/* Page Content */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}