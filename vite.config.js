import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            proxyRequest.setHeader('x-t040-dev-client', request.headers.host || 'local');
          });
        },
      },
    },
  },
});
