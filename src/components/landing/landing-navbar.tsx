"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export const LandingNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="w-full bg-transparent z-40 py-6 sm:py-8 px-6 sm:px-10 lg:px-16 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        {/* Brand Wordmark (pure white, medium weight) */}
        <Link href="/" className="group inline-flex items-center">
          <span className="text-xl sm:text-2xl font-semibold tracking-tight text-white group-hover:opacity-90 transition-opacity">
            OrbitWork
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-10 lg:gap-14">
          <div className="flex items-center gap-8 lg:gap-11 text-xs font-semibold tracking-[0.2em] text-[#A0A5C2] uppercase">
            <a href="#services" className="hover:text-white transition-colors duration-200">
              SERVICES
            </a>
            <a href="#company" className="hover:text-white transition-colors duration-200">
              COMPANY
            </a>
            <a href="#team" className="hover:text-white transition-colors duration-200">
              TEAM
            </a>
            <a href="#faqs" className="hover:text-white transition-colors duration-200">
              FAQS
            </a>
          </div>

          {/* Outlined Pill LOGIN Button */}
          <Link
            href="/sign-in"
            className="rounded-full border border-white/30 hover:border-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10 transition-all duration-200"
          >
            LOGIN
          </Link>
        </nav>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white/80 hover:text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 rounded-2xl border border-white/10 bg-[#0B0D1B]/95 backdrop-blur-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex flex-col gap-4 text-xs font-semibold tracking-[0.2em] text-[#A0A5C2] uppercase">
            <a
              href="#services"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition"
            >
              SERVICES
            </a>
            <a
              href="#company"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition"
            >
              COMPANY
            </a>
            <a
              href="#team"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition"
            >
              TEAM
            </a>
            <a
              href="#faqs"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition"
            >
              FAQS
            </a>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            <Link
              href="/sign-in"
              className="w-full text-center rounded-full border border-white/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10 transition"
            >
              LOGIN
            </Link>
            <Link
              href="/sign-up"
              className="w-full text-center rounded-full bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-[#0B0D1B] hover:bg-neutral-100 transition"
            >
              EXPLORE
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
