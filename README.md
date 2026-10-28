# OnTrack

Equipment and repair tickets for the Four Corners restaurants: a mobile-first PWA on React + Vite, Supabase for data, auth and files, Cloudflare Workers for hosting.

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

Hosting is Cloudflare Workers with static assets, connected to this repo through Workers Builds: `main` is production and every other branch gets a preview URL plus a comment on its pull request. The Worker config is `app/wrangler.jsonc`; it serves `dist` and falls back to `index.html` for client-side routes and QR deep links.

Build settings in the Cloudflare dashboard (Workers & Pages, Create application, Continue with GitHub):

| Setting                              | Value                                        |
| ------------------------------------ | -------------------------------------------- |
| Root directory                       | `app`                                        |
| Build command                        | `npm run build`                              |
| Deploy command                       | `npx wrangler deploy`                        |
| Non-production branch deploy command | `npx wrangler versions upload` (the default) |
| Build variable                       | `NODE_VERSION` = `24`                        |

To check the config locally: `cd app && npm run build && npx wrangler deploy --dry-run`.
