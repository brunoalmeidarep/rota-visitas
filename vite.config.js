import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Minha Rota RP',
        short_name: 'Minha Rota RP',
        description: 'App de rota de visitas para representantes comerciais',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1a1a',
        theme_color: '#2a2a2a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
      },
      workbox: {
        // Pre-cache de todos os assets gerados pelo Vite
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
        // Aumenta limite de tamanho (nosso bundle JS é grande, ~4MB)
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Estratégias de runtime caching
        runtimeCaching: [
          {
            // Imagens externas (Supabase storage, etc): cache-first com expiração
            urlPattern: ({ url }) => url.origin !== self.location.origin && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagens-externas',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
              }
            }
          },
          {
            // Chamadas pro Supabase (API): network-first com fallback
            // Importante: NÃO faz cache de POST/PATCH/DELETE (só GET)
            urlPattern: ({ url }) => url.origin.includes('supabase.co'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hora
              }
            }
          }
        ],
        // Limpa caches antigos automaticamente
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false // SW SÓ no build de produção (evita problemas em dev)
      }
    })
  ],
  build: {
    outDir: 'dist'
  }
})
