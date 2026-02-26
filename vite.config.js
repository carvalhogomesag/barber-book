import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Arquivos que devem ser cacheados para uso offline
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Schedy AI - Automated Booking',
        short_name: 'Schedy',
        description: 'Your AI-powered booking concierge',
        theme_color: '#0F0F0F',
        background_color: '#0F0F0F',
        display: 'standalone', // Faz o app abrir sem as barras do navegador
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Permite que o Android ajuste o ícone
          }
        ]
      }
    })
  ],
})