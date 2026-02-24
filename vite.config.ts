import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      // ★修正: ここを相対パス './' に変更します。これでどの階層でも動きます。
      base: './', 

      plugins: [react()],
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },

      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
      },

      resolve: {
        alias: {
          '@': resolve(process.cwd(), './src'), 
        }
      },

      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      }
    };
});
