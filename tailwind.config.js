/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        /* BUI 分数级刻度 */
        "5.5": "1.375rem",
        "6.5": "1.625rem",
        "7.5": "1.875rem",
        "8.5": "2.125rem",
        "9.5": "2.375rem",
        "95": "23.75rem",
        "105": "26.25rem",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        qianwen: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        /* ── BUI (beautifului.dev) 设计令牌 ─────────────────── */
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        surface: "var(--surface)",
        "surface-solid": "var(--surface-solid)",
        field: "var(--field)",
        inset: "var(--inset)",
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        hover: {
          DEFAULT: "var(--hover)",
          2: "var(--hover-2)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        /* BUI 圆角体系 */
        card: "14px",
        control: "8px",
        chip: "6px",
      },
      boxShadow: {
        /* BUI 阴影体系 */
        card: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 32px rgba(0, 0, 0, 0.09)",
        hairline: "0 1px 2px rgba(0, 0, 0, 0.035)",
        raised: "0 4px 24px rgba(0, 0, 0, 0.14)",
        overlay: "0 16px 48px rgba(0, 0, 0, 0.2)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "zoom-in-spring": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "capsule-in": {
          "0%": { opacity: "0", transform: "scale(0.94) translateY(3.5px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "capsule-out": {
          "0%": { opacity: "1", transform: "scale(1) translateY(0)" },
          "100%": { opacity: "0", transform: "scale(0.96) translateY(1.5px)" },
        },
        "spring-popup": {
          "0%": { opacity: "0", transform: "scale(0.94) translateY(3.5px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        /* BUI 动效关键帧 */
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "zoom-spring": "zoom-in-spring 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "capsule-in": "capsule-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "capsule-out": "capsule-out 90ms cubic-bezier(0.4, 0, 1, 1) forwards",
        "spring-popup": "capsule-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        /* BUI 签名缓动 cubic-bezier(0.23, 1, 0.32, 1) */
        "fade-up": "fade-up 320ms cubic-bezier(0.23, 1, 0.32, 1)",
        "pop-in": "pop-in 200ms cubic-bezier(0.23, 1, 0.32, 1)",
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate"),
  ],
};
