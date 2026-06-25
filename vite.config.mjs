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
    // Don't reload the dev app when build artifacts change.
    watch: { ignored: ['**/release/**', '**/dist/**'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
