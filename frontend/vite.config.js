import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy defaults to the local backend on :8000 — start both with
//   npm run dev          (from the project root)
// To dev only the frontend against the deployed Space, drop a one-line
// .env.local in this folder:
//   VITE_PROXY_TARGET=https://aradhyastuti-routelm.hf.space
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8000'
  const isHttps = proxyTarget.startsWith('https')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttps,
          ws: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
    },
  }
})
