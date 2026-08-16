import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const offlineCsp = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "offline-content-security-policy",
      apply: "build",
      transformIndexHtml(html) {
        const meta = `<meta http-equiv="Content-Security-Policy" content="${offlineCsp}">`;
        return html.includes("Content-Security-Policy") ? html : html.replace(/(<meta\s+name=["']referrer["'][^>]*>)/i, `$1${meta}`);
      }
    },
    viteSingleFile()
  ],
  base: "./",
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
