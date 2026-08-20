import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Playwright specs (tests/e2e) run via `npm run e2e`, not vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://fnandjtzwhihgefkfwzj.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/functions/v1/api'),
      },
    },
  },
})
