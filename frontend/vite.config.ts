import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // three.js + R3F is a large but well-cached vendor payload; the default
    // 500 kB warning isn't actionable here.
    chunkSizeWarningLimit: 1500,
  },
})
