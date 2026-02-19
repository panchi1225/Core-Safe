import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      // GitHub Pagesのリポジトリ名（大文字小文字を正確に）
      base: "/Core-Safe/", 

      plugins: [react()],
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },

      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true, // ビルド前にdistを空にする（重要）
      },

      resolve: {
        alias: {
          // __dirname を使わず、process.cwd() を基準にする（安全）
          '@': resolve(process.cwd(), './src'), 
        }
      },

      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      }
    };
});
