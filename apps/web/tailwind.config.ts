import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: {
          950: "#070b13",
          900: "#0b1220",
          850: "#0f172a",
          800: "#131c2e",
          700: "#1e293b",
        },
        accent: {
          DEFAULT: "#22d3ee",
          soft: "#0e7490",
        },
        risk: {
          low: "#22c55e",
          medium: "#eab308",
          high: "#f97316",
          critical: "#ef4444",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,.25), 0 8px 30px -12px rgba(34,211,238,.25)",
      },
    },
  },
  plugins: [],
};

export default config;
