import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Where the dev server forwards /api. On the host that's localhost; inside
// docker-compose.dev.yml the backend is a sibling service, so VITE_PROXY_TARGET
// overrides it (see docker-compose.dev.yml).
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Recharts (and its d3 dependencies) dwarf the app code, so give them
        // their own long-cached chunk instead of one 570 kB bundle.
        manualChunks: {
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // In development the frontend calls relative "/api/..." URLs and Vite
    // proxies them to the FastAPI server, so there are no CORS surprises and
    // no environment variable is needed to run locally.
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})
