/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vite Plugin to write package.json version into public/version.json
function versionWriterPlugin() {
  return {
    name: 'write-version-json',
    buildStart() {
      try {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const versionData = { version: pkg.version || '1.0.0' };

        const outPath = resolve(process.cwd(), 'public', 'version.json');
        writeFileSync(outPath, JSON.stringify(versionData, null, 2));
        console.log(`[vite-plugin-version] Wrote version.json: ${pkg.version}`);
      } catch (err) {
        console.warn('[vite-plugin-version] Failed to write version.json:', err);
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    versionWriterPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  optimizeDeps: {
    include: [
      '@carbon/ibmdotcom-web-components/es/components/card-section-carousel/index.js',
      '@carbon/ibmdotcom-web-components/es/components/card/index.js',
      '@carbon/ibmdotcom-web-components/es/components/carousel/index.js',
      '@carbon/ibmdotcom-web-components/es/components/link-with-icon/index.js',
      '@carbon/ibmdotcom-web-components/es/components/content-section/index.js',
      '@carbon/ibmdotcom-web-components/es/components/leadspace/index.js',
      '@carbon/ibmdotcom-web-components/es/components/pricing-table/index.js',
      '@carbon/ibmdotcom-web-components/es/components/masthead/index.js',
      '@carbon/ibmdotcom-web-components/es/components/footer/index.js',
    ],
  },

  // @ts-ignore — vitest property, valid when running vitest
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {},
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
