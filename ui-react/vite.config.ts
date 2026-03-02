/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],

  optimizeDeps: {
    include: [
      '@carbon/ibmdotcom-web-components/es/components/card-section-carousel/index.js',
      '@carbon/ibmdotcom-web-components/es/components/card/index.js',
      '@carbon/ibmdotcom-web-components/es/components/carousel/index.js',
      '@carbon/ibmdotcom-web-components/es/components/link-with-icon/index.js',
      '@carbon/ibmdotcom-web-components/es/components/content-section/index.js',
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
