import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site at <user>.github.io/<repo>/, not at the domain
// root, so every asset URL the build emits needs that /1-link/ prefix or the deployed
// page loads with no CSS or JS. Only applies when actually building for Pages —
// `npm run dev` and `npm run build` for any other host still want the root path.
const base = process.env.GITHUB_PAGES === 'true' ? '/1-link/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
})