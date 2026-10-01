import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Disabling the modulepreload polyfill removes the only inline script Vite
    // injects into index.html, allowing us to drop 'unsafe-inline' from the CSP.
    // All browsers in our target audience support <link rel="modulepreload"> natively.
    modulePreload: { polyfill: false },
  },
  server: {
    port: 3000,
    open: true,
  },
});
