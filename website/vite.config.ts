import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Standalone static build: no vinext, no Cloudflare Workers, no ChatGPT Sites.
// `npm run build` emits dist/client — upload it to any web host.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    assetsInlineLimit: 4096,
  },
  server: { port: 5175 },
});
