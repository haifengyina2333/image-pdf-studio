import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Builds a single self-contained IIFE JS + CSS bundle for the offline single-file HTML edition.
// Classic IIFE script works directly on file:// in Chrome, Safari, Edge, and Firefox with zero CORS issues.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    __OFFLINE_SINGLE_FILE__: 'true',
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    copyPublicDir: false,
    target: ['chrome110', 'edge110', 'firefox115', 'safari16.4'],
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    lib: {
      entry: 'src/main.tsx',
      name: 'ImagePdfStudioApp',
      formats: ['iife'],
      fileName: () => 'app.iife.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => (assetInfo.name?.endsWith('.css') ? 'app.css' : 'asset-[name][extname]')
      }
    }
  }
});
