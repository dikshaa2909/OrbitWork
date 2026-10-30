"use client";

import React from "react";
import Link from "next/link";
import { LandingNavbar } from "./landing-navbar";
import { FigmaPillVisual } from "./figma-pill-visual";

export const LandingView: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0D1B] via-[#0D0F22] to-[#12132A] text-white selection:bg-purple-500/30 selection:text-white relative flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Subtle deep ambient background lighting */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 right-[10%] w-[550px] h-[550px] rounded-full bg-gradient-to-b from-indigo-700/15 via-purple-700/10 to-transparent blur-[120px]" />
        <div className="absolute bottom-0 left-[5%] w-[400px] h-[400px] rounded-full bg-blue-900/10 blur-[100px]" />
      </div>

      {/* Top Navigation */}
      <LandingNavbar />

      {/* Hero Section: Left-Aligned Content + Right-Side 3D Pill Geometry */}
      <main className="flex-1 flex items-center max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full">
          {/* Left Column: Bold Editorial Typography */}
          <div className="lg:col-span-7 flex flex-col items-start text-left z-10 space-y-7 sm:space-y-8">
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[92px] font-bold tracking-tight text-white leading-[0.96] select-none">
              Projects<br />
              Management<br />
              Platform
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-[#9AA0C2] max-w-lg leading-relaxed font-normal">
              We are your all in one platform to manage your projects, workflow and deadlines.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-white text-[#0B0D1B] font-bold text-xs sm:text-sm uppercase tracking-[0.2em] px-9 sm:px-11 py-4 hover:bg-neutral-100 transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xl shadow-indigo-950/60"
              >
                EXPLORE
              </Link>

              <Link
                href="/join"
                className="text-xs font-medium tracking-wide text-[#7A7F9D] hover:text-white transition-colors duration-200 py-2 sm:px-2"
              >
                Have a team or college join code? <span className="underline underline-offset-4 decoration-white/30">Enter here →</span>
              </Link>
            </div>
          </div>

          {/* Right Column: 3D Capsule Pill Visual */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end relative">
            <FigmaPillVisual />
          </div>
        </div>
      </main>

      {/* Minimal Bottom Bar */}
      <footer className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-6 text-xs text-[#5E6482] flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.05]">
        <span>OrbitWork © {new Date().getFullYear()}</span>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="hover:text-neutral-300 transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-neutral-300 transition-colors">
            Terms
          </Link>
          <Link href="/join" className="hover:text-neutral-300 transition-colors">
            Student & Faculty Join
          </Link>
        </div>
      </footer>
    </div>
  );
};
