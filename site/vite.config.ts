import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { wireframeTheme } from "./plugins/wireframeTheme";

export default defineConfig({
  plugins: [react(), wireframeTheme()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
  },
});
