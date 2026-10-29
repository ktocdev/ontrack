/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }

/**
 * Response headers for the Cloudflare Worker, written to dist/_headers after
 * every build (Workers static assets read that file). The content security
 * policy allows this origin, the Supabase project (API, storage, realtime)
 * and the theme script inlined in index.html, by hash, so a script injected
 * into the page can neither run nor phone home with the session. A new
 * external origin (a font host, an API) has to be added here.
 */
function securityHeaders(supabaseUrl: string | undefined): Plugin {
  let outDir = 'dist'
  return {
    name: 'ontrack:security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .filter((s): s is string => Boolean(s))
      const hashes = inlineScripts.map((s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`)
      const supabase = supabaseUrl ? new URL(supabaseUrl).origin : 'https://*.supabase.co'
      const csp = [
        `default-src 'self'`,
        `script-src 'self' ${hashes.join(' ')}`.trimEnd(),
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: ${supabase}`,
        `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, 'wss:')}`,
        // Vite inlines font files under 4 KB (small fontsource subsets) as data: URIs.
        `font-src 'self' data:`,
        `manifest-src 'self'`,
        `worker-src 'self'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `object-src 'none'`,
      ].join('; ')
      const lines = [
        '/*',
        `  Content-Security-Policy: ${csp}`,
        '  X-Frame-Options: DENY',
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: camera=(self), geolocation=(), microphone=(), payment=()',
        '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
        '',
      ]
      writeFileSync(resolve(outDir, '_headers'), lines.join('\n'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }

  // The e2e build's role picker signs anyone in as anyone. Playwright sets the
  // flag for its own build; a Cloudflare build (WORKERS_CI) must never have it.
  if (env.VITE_E2E_MOCK === '1' && process.env.WORKERS_CI) {
    throw new Error('VITE_E2E_MOCK=1 is set in a Workers build; the mock sign-in must not be deployed')
  }

  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'OnTrack',
          short_name: 'OnTrack',
          description: 'Equipment and repair tickets for the Four Corners restaurants.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f3f4f1',
          theme_color: '#12634f',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache the app shell; data is fetched live (offline writes are Phase 8).
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/e\//], // QR deep links resolve through the app, not the fallback cache
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
      securityHeaders(env.VITE_SUPABASE_URL),
    ],
    server: { port: 5173, host: true },
    preview: { port: 4173 },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }
})
