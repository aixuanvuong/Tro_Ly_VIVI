import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  define: {
    // This prevents "process is not defined" error when using process.env.API_KEY
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})