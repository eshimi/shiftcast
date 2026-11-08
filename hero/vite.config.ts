import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// 既存の素のJSアプリに差し込むため、IIFE 1ファイル(hero.js)+CSS(hero.css) として ../public/hero に出力する。
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false,
  build: {
    outDir: "../public/hero",
    emptyOutDir: false, // shots/ を消さない
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "KiatsuHero",
      formats: ["iife"],
      fileName: () => "hero.js",
    },
    rollupOptions: { output: { assetFileNames: "hero.[ext]" } },
  },
});
