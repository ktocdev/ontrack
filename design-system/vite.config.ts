/// <reference types="vitest/config" />
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

/**
 * The docs site lives under one path on another site (ktoc.dev/ontrack/design-system),
 * served by its own Cloudflare Worker on that route. So every URL it builds starts with
 * BASE, and the files sit under the same folders inside dist/, which is the Worker's
 * asset root: a request for /ontrack/design-system/assets/x.js finds dist/ontrack/design-system/assets/x.js.
 */
const BASE = '/ontrack/design-system/'
const OUT = resolve(import.meta.dirname, 'dist')
const SITE = resolve(OUT, BASE.slice(1))

/**
 * After the build: a copy of index.html at the asset root, which is what the Worker's
 * single-page fallback serves for a deep link; a redirect from / to the site; and the
 * response headers. The site is for whoever has the link, so it asks not to be indexed.
 * Google Fonts is allowed because the token editor tries fonts the app does not bundle.
 */
function workerFiles(): Plugin {
  return {
    name: 'ontrack-ds:worker-files',
    apply: 'build',
    closeBundle() {
      mkdirSync(OUT, { recursive: true })
      copyFileSync(resolve(SITE, 'index.html'), resolve(OUT, 'index.html'))
      writeFileSync(resolve(OUT, '_redirects'), `/ ${BASE} 302\n/ontrack/design-system ${BASE} 301\n`)
      const csp = [
        `default-src 'self'`,
        `script-src 'self'`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `font-src 'self' data: https://fonts.gstatic.com`,
        `img-src 'self' data: blob:`,
        `connect-src 'self'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `object-src 'none'`,
      ].join('; ')
      writeFileSync(
        resolve(OUT, '_headers'),
        [
          '/*',
          `  Content-Security-Policy: ${csp}`,
          '  X-Robots-Tag: noindex, nofollow',
          '  X-Frame-Options: DENY',
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: no-referrer',
          '',
        ].join('\n'),
      )
    },
  }
}

// The app's components import these. Without dedupe, a file under ../app/src would load
// the app's own copy of React beside this package's, and hooks would break.
const SHARED = [
  'react',
  'react-dom',
  'react-router',
  'radix-ui',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/modifiers',
  '@dnd-kit/utilities',
]

export default defineConfig({
  base: BASE,
  // One page, no code splitting: React, Radix and dnd-kit are most of it (~200 KB gzipped).
  build: { outDir: SITE, emptyOutDir: true, chunkSizeWarningLimit: 800 },
  resolve: {
    alias: { '@app': resolve(import.meta.dirname, '../app/src') },
    dedupe: SHARED,
  },
  define: {
    // The app's own build-time constants, which a few shared files read.
    __APP_VERSION__: JSON.stringify('docs'),
    __E2E_MOCK__: 'false',
  },
  plugins: [react(), tailwindcss(), workerFiles()],
  server: { port: 5180, fs: { allow: ['..'] } },
  preview: { port: 4180 },
  // Vitest empties CSS imports by default, ?raw included; the token model needs tokens.css.
  test: { environment: 'node', include: ['src/**/*.test.ts'], css: { include: [/tokens\.css/] } },
})
