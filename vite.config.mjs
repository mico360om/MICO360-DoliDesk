import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The renderer lives in /src and is served at the repo root.
// base: './' makes asset paths relative so Electron can load the
// built files from disk via file:// in production.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
