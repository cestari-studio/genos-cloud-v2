import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../ui',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@carbon/react')) return 'vendor-carbon';
            if (id.includes('@carbon/icons-react') || id.includes('@carbon/charts')) return 'vendor-carbon-assets';
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
