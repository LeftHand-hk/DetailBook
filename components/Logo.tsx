"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────
   Logo — SVG icon + dynamic wordmark
   Reads platform name from localStorage (set in admin panel).
   Falls back to "DetailBook" if not set.
───────────────────────────────────────────────────── */

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  href?: string;
  wordmark?: boolean;
  darkText?: boolean;
  className?: string;
}

const sizes = {
  xs: { icon: 28, text: "text-base",  gap: "gap-2"   },
  sm: { icon: 34, text: "text-lg",    gap: "gap-2.5" },
  md: { icon: 40, text: "text-xl",    gap: "gap-3"   },
  lg: { icon: 52, text: "text-2xl",   gap: "gap-3"   },
  xl: { icon: 68, text: "text-3xl",   gap: "gap-4"   },
};

function getPlatformNameFromStorage(): string {
  try {
    const data = JSON.parse(localStorage.getItem("detailbook_platform") || "{}");
    return data.platformName || "DetailBook";
  } catch {
    return "DetailBook";
  }
}

export function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="lb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
        <radialGradient id="lb-shine" cx="30%" cy="25%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <filter id="lb-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="200" height="200" rx="44" fill="url(#lb-bg)" />
      <rect width="200" height="200" rx="44" fill="url(#lb-shine)" />

      {/* D letterform */}
      <path
        fillRule="evenodd"
        fill="white"
        d="M 48 46 L 48 154 L 100 154
           Q 158 154 158 100
           Q 158 46 100 46 Z
           M 72 70 L 100 70
           Q 134 70 134 100
           Q 134 130 100 130
           L 72 130 Z"
      />

      {/* Sparkles top-right */}
      <g filter="url(#lb-glow)" opacity="0.95">
        <path
          fill="white"
          d="M 155 38 L 158 48 L 168 51 L 158 54 L 155 64
             L 152 54 L 142 51 L 152 48 Z"
        />
        <path
          fill="white"
          opacity="0.7"
          d="M 140 22 L 142 28 L 148 30 L 142 32 L 140 38
             L 138 32 L 132 30 L 138 28 Z"
        />
        <circle cx="164" cy="26" r="4" fill="white" opacity="0.5" />
        <circle cx="172" cy="40" r="2.5" fill="white" opacity="0.4" />
      </g>

      {/* Shine streak */}
      <path
        d="M 55 62 Q 90 55 120 70"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.2"
      />
    </svg>
  );
}

export function LogoWordmark({ darkText = false, size = "text-xl" }: { darkText?: boolean; size?: string }) {
  const [name, setName] = useState("DetailBook");

  useEffect(() => {
    setName(getPlatformNameFromStorage());
  }, []);

  return (
    <span className={`${size} font-black tracking-tight leading-none`}>
      <span className={darkText ? "text-gray-900" : "text-white"}>{name}</span>
    </span>
  );
}

export default function Logo({
  size = "md",
  href,
  wordmark = true,
  darkText = false,
  className = "",
}: LogoProps) {
  const { icon, text, gap } = sizes[size];

  const inner = (
    <span className={`flex items-center ${gap} ${className}`}>
      <LogoIcon size={icon} />
      {wordmark && <LogoWordmark darkText={darkText} size={text} />}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {inner}
      </Link>
    );
  }

  return inner;
}
