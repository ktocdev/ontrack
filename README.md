# OnTrack

Equipment and repair tickets for the Four Corners restaurants: a mobile-first PWA on React + Vite, Supabase for data, auth and files, Cloudflare Pages for hosting.

The plan lives in [handoff/OnTrack - Build Plan.md](handoff/OnTrack%20-%20Build%20Plan.md). The design lives in [design/](design/) and is the source of truth for every screen. Agent and contributor rules are in [CLAUDE.md](CLAUDE.md).

## Layout

```
app/        Vite + React + TypeScript PWA
supabase/   migrations, functions, seed, pgTAP tests (from OT-2)
design/     exported design: screens, tokens, index
handoff/    build plan, slides, architecture diagram
```

## Run the app

```sh
cd app
npm ci
npm run dev          # http://localhost:5173
npm test             # Vitest
npm run test:e2e     # Playwright on Chromium + WebKit (builds first)
npm run build        # production build in app/dist
```

## Deploy

Cloudflare Pages is connected to this repo through its Git integration, so `main` is production and every pull request gets a preview URL. Project settings:

| Setting | Value |
| --- | --- |
| Root directory | `app` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `24` (`NODE_VERSION` environment variable) |

`app/public/_redirects` sends every path to `index.html` so client-side routes and QR deep links resolve.
