import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { API_URL } = loadEnv(mode, process.cwd(), '')
  if (!API_URL) throw new Error('API_URL is not set. Copy .env.example to .env.')
  return {
    plugins: [react()],
    server: {
      // The API sends no CORS headers, so the browser calls /api/* and Vite forwards it to API_URL.
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
          // The browser only talks to Vite, same-origin. Forwarding its Origin makes Spring
          // treat proxied POSTs (crop history, planning) as cross-origin and reject them with 403.
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => proxyReq.removeHeader('origin'))
          },
        },
      },
    },
  }
})
