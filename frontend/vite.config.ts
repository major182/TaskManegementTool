import react from '@vitejs/plugin-react'
// vitest の設定（test キー）にも型が付くよう、vitest/config の defineConfig を使う
import { defineConfig } from 'vitest/config'

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
  test: {
    // 画面のテストではブラウザの API（document など）が要るため jsdom を使う
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
