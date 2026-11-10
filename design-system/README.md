# OnTrack design system

Docs for OnTrack's tokens and components, with a token editor. It is not part of the app: nothing in the app links here, it builds and deploys on its own, and it lives at `ktoc.dev/ontrack/design-system` (asks not to be indexed).

Every example renders the app's own components from `app/src/components`, styled by the app's own `index.css` and `tokens.css`, which the docs read at build time. So the docs never hold a copy of a value: change the app and the docs follow.

## Run it

```sh
cd app && npm ci          # the docs use the app's CSS entry and its components' packages
cd ../design-system
npm ci
npm run dev               # http://localhost:5180/ontrack/design-system/
npm run lint && npm run typecheck && npm test
npm run build             # dist/, laid out for the Worker (below)
```

On Windows, run Vitest from a path with a capital drive letter (`C:\…`, not `c:\…`): with a lowercase one Vitest loads itself twice and every test fails with "failed to find the current suite".

## Layout

```
src/
  tokens/   source.ts parses app/src/styles/tokens.css; editor.ts is the edit model (ramps,
            resolving, the injected CSS, export); color.ts is OKLCH and contrast; store.tsx
            holds the edits; fonts.ts lists the fonts on offer
  editor/   the token panel and its tabs
  chrome/   the docs frame (sidebar, top bar) and page building blocks (Example, Props, Rules)
  pages/    one component per page; registry.tsx is the sidebar and the routes
```

The docs chrome has its own `--ds-*` colors, so editing tokens restyles the OnTrack examples and never the page you edit them from.

## The token editor

- **Color.** Every color token follows one of five ramps (brand, neutral, danger, info, warning), chosen by name. A ramp's base is a token (`--brand`, `--text-muted`, `--danger`, `--info`, `--status-waiting-text`). Moving the base by hue, chroma or lightness moves each token on the ramp by the same amount in OKLCH, so tints stay tints and nothing changes until you move something. A token can also be pinned to a step or set by hand. Colors written with `var()` or `color-mix()` follow the tokens they name. Restaurant accents follow no ramp.
- **Light and dark are separate.** Color and Shadow edit whichever theme the page shows. Type, Shape and Space are shared.
- **Type**: display, body and mono families, from the bundled three or Google Fonts while trying.
- **Shape**: one radius strength plus each radius. Pills stay pills.
- **Shadow**: opacity and size, per theme.
- **Space**: scales Tailwind's spacing unit and `--screen-pad`. Tap targets and button heights never scale.
- **Contrast**: WCAG ratios for the pairs the boards use, read from what is painted.
- **Export**: a `tokens.css` with the values written in place (comments and order kept) to replace `app/src/styles/tokens.css`, plus the `@fontsource` packages a new font needs. Edits are saved in the browser only; Copy edits as JSON moves a draft between browsers.

## Deploy

Its own Cloudflare Worker, `ontrack-design-system` (`wrangler.jsonc`), on the route `ktoc.dev/ontrack/design-system*`. A route takes precedence over the portfolio's custom domain on the same host, so the portfolio needs no change. The build writes the site under `dist/ontrack/design-system/` (the Worker's asset root is `dist/`), a copy of `index.html` at `dist/` for deep links, `_redirects`, and `_headers` with the CSP and `X-Robots-Tag: noindex`.

Set up once, in the Cloudflare dashboard (Workers & Pages, Create, Import a repository):

- Repository: this one. Root directory: `design-system`.
- Build command: `npm ci --prefix ../app && npm ci && npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`. Build watch paths: `design-system/*`, `app/src/components/*`, `app/src/styles/*`, `app/src/index.css`.
- It needs no build variables: the docs talk to no backend.

To deploy by hand instead: `npm run build && npx wrangler deploy` from this folder.
