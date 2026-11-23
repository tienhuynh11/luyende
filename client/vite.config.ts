import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: `http://localhost:${process.env.SERVER_PORT ?? 8787}`, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    reportCompressedSize: false,
  },
});
