import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
          600: "#475569",
        },
        brand: {
          blue: "#3B82F6",
          "blue-dark": "#2563EB",
          "blue-light": "#60A5FA",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeInUp: {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInLeft: {
          "0%":   { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%":   { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(59,130,246,0.4)" },
          "50%":      { boxShadow: "0 0 40px rgba(59,130,246,0.8), 0 0 60px rgba(59,130,246,0.3)" },
        },
        blobFloat: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%":      { transform: "translate(20px,-20px) scale(1.05)" },
          "66%":      { transform: "translate(-10px,10px) scale(0.97)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
      animation: {
        fadeInUp:     "fadeInUp 0.6s ease forwards",
        fadeIn:       "fadeIn 0.5s ease forwards",
        slideInLeft:  "slideInLeft 0.5s ease forwards",
        scaleIn:      "scaleIn 0.4s ease forwards",
        float:        "float 4s ease-in-out infinite",
        glowPulse:    "glowPulse 2.5s ease-in-out infinite",
        blobFloat:    "blobFloat 8s ease-in-out infinite",
        shimmer:      "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
