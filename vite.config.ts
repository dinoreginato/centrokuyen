import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildVersion = new Date().toISOString()

const appVersionPlugin = () => ({
  name: 'app-version-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: buildVersion }, null, 2),
    })
  },
})

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    appVersionPlugin(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
