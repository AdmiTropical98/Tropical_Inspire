import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Gestão Frota',
        short_name: 'GestãoFrota',
        description: 'Aplicação de Gestão de Frota e Motoristas',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-bg-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-bg-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB to handle large chunks
      }
    })
  ],
  base: '/',
  server: {
    proxy: {
      '/api/cartrack': {
        target: 'https://fleetapi-pt.cartrack.com/rest',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cartrack/, ''),
        secure: false
      }
    }
  }
})
