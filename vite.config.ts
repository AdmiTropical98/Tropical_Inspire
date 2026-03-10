import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.png', 'grid-pattern.svg'],
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
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB to handle large chunks and assets
      }
    })
  ],
  base: '/',
  server: {
    proxy: {
      '/api/send-email': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/email': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/cartrack': {
        target: 'https://fleetapi-pt.cartrack.com/rest',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cartrack/, ''),
        secure: false
      }
    }
  }
})
