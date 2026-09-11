import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // W trybie deweloperskim frontend stoi na 5173, a API na 8090 —
    // proxy sprawia, że w kodzie klienta wszędzie jest po prostu /api.
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
