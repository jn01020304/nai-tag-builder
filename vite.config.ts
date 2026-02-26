import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin()
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  preview: {
    cors: true,
  },
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'NaiTagBuilder',
      fileName: () => 'nai-tag-builder.js',
      formats: ['iife']
    },
    rollupOptions: {}
  }
});