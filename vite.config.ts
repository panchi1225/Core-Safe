import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // ★重要: リポジトリ名と同じにする
  base: '/Core-Safe/',
  plugins: [react()],
  server: { port: 3000, host: '0.0.0.0' },
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true },
  resolve: { alias: { '@': resolve(process.cwd(), './src') } }
});
