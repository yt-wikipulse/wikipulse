/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: (filePath) => (filePath.endsWith(".woff2") ? false : undefined),
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "h3", test: /node_modules[\\/]h3-js[\\/]/ }],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.BACKEND_URL ?? "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
