"use client";

import React from "react";

export const FigmaPillVisual: React.FC = () => {
  return (
    <div className="relative w-full max-w-[560px] h-[480px] sm:h-[560px] lg:h-[620px] flex items-center justify-center select-none pointer-events-none">
      {/* Deep atmospheric ambient glow behind the geometry */}
      <div className="absolute w-[440px] h-[440px] rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-violet-400/20 blur-[90px] -z-10" />

      {/* 3D Diagonal Capsule & Pill Geometry */}
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full overflow-visible drop-shadow-[0_25px_45px_rgba(15,17,38,0.7)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main Primary Cylinder Gradient: Deep rich indigo to luminous lavender */}
          <linearGradient id="mainPillGrad" x1="120" y1="120" x2="480" y2="480" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C4B5FD" />
            <stop offset="28%" stopColor="#A78BFA" />
            <stop offset="65%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>

          {/* Secondary Left Pill Gradient */}
          <linearGradient id="secondaryPillGrad" x1="180" y1="80" x2="420" y2="520" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DDD6FE" />
            <stop offset="35%" stopColor="#8B5CF6" />
            <stop offset="75%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>

          {/* Accent Small Floating Pill Gradient */}
          <linearGradient id="accentPillGrad" x1="80" y1="200" x2="300" y2="420" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EDE9FE" />
            <stop offset="40%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>

          {/* Specular Highlight Gradient */}
          <linearGradient id="specularGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="30%" stopColor="#E0E7FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
          </linearGradient>

          {/* Inner Shadow / Depth Shading Filter */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Ring / Disc Accent in background */}
        <ellipse
          cx="300"
          cy="300"
          rx="210"
          ry="90"
          transform="rotate(-28 300 300)"
          stroke="#4F46E5"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="4 8"
        />

        {/* ── Background Pill (Tilted Cylinder 1) ── */}
        <g transform="rotate(-32 300 300)">
          {/* Cast drop shadow */}
          <rect
            x="330"
            y="110"
            width="100"
            height="360"
            rx="50"
            fill="#090A17"
            opacity="0.6"
            className="blur-xl"
          />

          {/* Cylinder Body */}
          <rect
            x="320"
            y="100"
            width="100"
            height="360"
            rx="50"
            fill="url(#secondaryPillGrad)"
          />

          {/* Inner Light Rim */}
          <rect
            x="322"
            y="102"
            width="96"
            height="356"
            rx="48"
            stroke="url(#specularGrad)"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
        </g>

        {/* ── Primary Hero 3D Pill (Prominent Center Cylinder) ── */}
        <g transform="rotate(-32 300 300)">
          {/* Subtle Ambient Occlusion Shadow */}
          <rect
            x="190"
            y="70"
            width="135"
            height="440"
            rx="67.5"
            fill="#070814"
            opacity="0.75"
            className="blur-2xl"
          />

          {/* Main 3D Volume */}
          <rect
            x="180"
            y="55"
            width="135"
            height="440"
            rx="67.5"
            fill="url(#mainPillGrad)"
          />

          {/* Top Cap Specular Highlight Dome */}
          <ellipse
            cx="247.5"
            cy="122.5"
            rx="48"
            ry="48"
            fill="#FFFFFF"
            opacity="0.25"
            className="blur-sm"
          />

          {/* Outer Razor Rim Highlight */}
          <rect
            x="182"
            y="57"
            width="131"
            height="436"
            rx="65.5"
            stroke="url(#specularGrad)"
            strokeWidth="2"
            strokeOpacity="0.85"
          />

          {/* Longitudinal Light Streak */}
          <line
            x1="202"
            y1="120"
            x2="202"
            y2="410"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeOpacity="0.4"
            strokeLinecap="round"
          />
        </g>

        {/* ── Foreground Floating Pill (Cylinder 3 - Lower Front) ── */}
        <g transform="rotate(-32 300 300)">
          {/* Shadow */}
          <rect
            x="85"
            y="210"
            width="90"
            height="270"
            rx="45"
            fill="#080A16"
            opacity="0.7"
            className="blur-lg"
          />

          {/* Cylinder Body */}
          <rect
            x="75"
            y="195"
            width="90"
            height="270"
            rx="45"
            fill="url(#accentPillGrad)"
          />

          {/* Rim light */}
          <rect
            x="77"
            y="197"
            width="86"
            height="266"
            rx="43"
            stroke="url(#specularGrad)"
            strokeWidth="1.5"
            strokeOpacity="0.75"
          />
        </g>

        {/* Floating Minimal Spheres for depth */}
        <circle cx="470" cy="180" r="16" fill="url(#mainPillGrad)" />
        <circle cx="468" cy="178" r="15" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.6" />

        <circle cx="140" cy="480" r="11" fill="url(#secondaryPillGrad)" />
        <circle cx="139" cy="479" r="10" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.5" />
      </svg>
    </div>
  );
};

