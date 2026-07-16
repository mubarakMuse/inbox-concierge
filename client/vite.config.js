import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true,
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // ensure streaming
            if (req.headers.accept === 'text/event-stream') {
              proxyReq.setHeader('Accept', 'text/event-stream')
            }
          })
        },
      },
    },
  },
});
