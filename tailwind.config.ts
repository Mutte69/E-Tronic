import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        surface: "#141413",
        "surface-raised": "#1B1A18",
        line: "#2A2926",
        paper: "#F5F3EE",
        muted: "#8C887F",
        copper: {
          DEFAULT: "#C6793D",
          bright: "#E8A85C",
          dim: "#8A5227",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        grid: "linear-gradient(to right, #1B1A18 1px, transparent 1px), linear-gradient(to bottom, #1B1A18 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
export default config;
