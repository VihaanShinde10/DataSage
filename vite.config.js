import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    host: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  css: {
    postcss: './postcss.config.js',
    modules: {
      localsConvention: 'camelCase'
    }
  },
  logLevel: 'info',
  clearScreen: false
}); 