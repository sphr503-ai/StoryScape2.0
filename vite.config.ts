
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Ensure API_KEY is always a string to prevent runtime reference errors
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  server: {
    hmr: {
      // Disabling the overlay prevents the "500 error" popup from spamming the UI 
      // when the dev server connection is unstable.
      overlay: false 
    },
    // Adding a slight delay to retries to prevent rapid-fire network requests
    watch: {
      usePolling: true,
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
