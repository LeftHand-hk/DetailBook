"use client";

import Link from "next/link";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  href?: string;
  wordmark?: boolean;
  darkText?: boolean;
  className?: string;
}

const sizes = {
  xs: { icon: 28, brandHeight: 26 },
  sm: { icon: 34, brandHeight: 32 },
  md: { icon: 40, brandHeight: 38 },
  lg: { icon: 52, brandHeight: 48 },
  xl: { icon: 68, brandHeight: 60 },
};

/* The supplied files include generous presentation margins. The containers
   crop those margins at render time so both marks remain clear at nav sizes. */
export function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-[24%] bg-[#020713] shadow-sm ring-1 ring-white/10"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/detailbook-icon.webp"
        alt="DetailBook logo"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );
}

export function LogoBrand({
  height = 38,
  darkText = false,
}: {
  height?: number;
  darkText?: boolean;
}) {
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: Math.round(height * 4.88), height }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          darkText
            ? "/detailbook-logo-transparent-dark.png"
            : "/detailbook-logo-transparent.png"
        }
        alt="DetailBook"
        className="pointer-events-none h-full w-full select-none object-contain"
        draggable={false}
      />
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
  const { icon, brandHeight } = sizes[size];

  const inner = (
    <span className={`inline-flex items-center ${className}`}>
      {wordmark ? (
        <LogoBrand height={brandHeight} darkText={darkText} />
      ) : (
        <LogoIcon size={icon} />
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label="DetailBook home">
        {inner}
      </Link>
    );
  }

  return inner;
}
