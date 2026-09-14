import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080810",
          900: "#0d0d18",
          850: "#12121f",
          800: "#181828",
          700: "#232336",
          600: "#34344c",
        },
        mist: {
          400: "#8a8aa3",
          300: "#a9a9bf",
          200: "#d4d4e2",
        },
        zura: {
          DEFAULT: "#7C5CFF",
          400: "#9a82ff",
          600: "#6545f0",
        },
        usdc: "#2775CA",
        easy: "#34d399",
        medium: "#60a5fa",
        hard: "#f59e0b",
        critical: "#f43f5e",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
