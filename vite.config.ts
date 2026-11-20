import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  define: { __OFFLINE_SINGLE_FILE__: 'false' },
  plugins: [react(), tailwindcss()],
  build: {
    target: ['chrome110', 'edge110', 'firefox115', 'safari16.4'],
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/pdfjs-dist')) return 'lazy-pdfjs';
          if (id.includes('node_modules/pdf-lib')) return 'lazy-pdflib';
          if (id.includes('node_modules/heic2any')) return 'lazy-heic';
          if (id.includes('node_modules/@mediapipe/tasks-vision')) return 'lazy-mediapipe';
        }
      }
    }
  }
});
