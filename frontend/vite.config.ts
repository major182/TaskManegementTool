import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 開発中は /api への通信をバックエンド（Spring Boot）へ転送する。
    // 同じオリジン扱いになるため、開発中は CORS と SameSite の問題が起きない。
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
})
