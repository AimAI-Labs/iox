/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        paper: {
          DEFAULT: "#F5F1E8",
          neutral: "#FAFAF7",
          cool: "#E9E9E5",
        },
        ink: {
          DEFAULT: "#111111",
          charcoal: "#30343A",
          carbon: "#242321",
          mute: "#7B7B7B",
          sub: "#9A9A9A",
        },
        plate: {
          cobalt: "#2148B8",
          terracotta: "#C65F38",
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
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate"),
  ],
};
