import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--bg-rgb) / <alpha-value>)",
        rule: "rgb(var(--rule-rgb) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent-rgb) / <alpha-value>)",
        paper: {
          DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
          neutral: "#FAFAF7",
          cool: "#E9E9E5",
        },
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          charcoal: "rgb(var(--charcoal-rgb) / <alpha-value>)",
          muted: "rgb(var(--muted-rgb) / <alpha-value>)",
          carbon: "rgb(var(--carbon-rgb) / <alpha-value>)",
          mute: "#7B7B7B",
          sub: "#9A9A9A",
        },
        plate: {
          cobalt: "rgb(var(--cobalt-rgb) / <alpha-value>)",
          terracotta: "rgb(var(--terracotta-rgb) / <alpha-value>)",
          signal: "#C83232",
          botanical: "#008A4B",
        },
      },
      fontFamily: {
        sans: [
          "'Geist'",
          "'PingFang SC'",
          "'Microsoft YaHei'",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "'Geist Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
