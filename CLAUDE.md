# OnTrack

Mobile-first PWA for equipment and repair tickets across the Four Corners restaurants. One person builds it with AI help, so every session starts from this file. The full plan is `handoff/OnTrack - Build Plan.md`; read the current phase section before starting work.

## Stack

- **App:** React 19, Vite, TypeScript, Tailwind v4 (tokens as CSS variables), Radix primitives, React Router, TanStack Query over `@supabase/supabase-js`. Installable PWA via `vite-plugin-pwa`.
- **Backend:** Supabase Postgres with row-level security on every table, Supabase Auth (email + password, invite only, TOTP), Supabase Storage, Edge Functions (Deno) only for jobs that need a secret or a server.
- **Hosting:** Cloudflare Workers with static assets (`app/wrangler.jsonc`), connected through Workers Builds: `main` is production, every other branch gets a preview URL and a PR comment.
- **Tests:** Vitest for logic, pgTAP for RLS policies, Playwright on Chromium and WebKit for flows. WebKit stands in for an iPhone.
- **CI:** `.github/workflows/ci.yml` runs two jobs on every PR and on `main`: the app (lint, format check, typecheck, Vitest, build, Playwright) and the database (`supabase db start`, pgTAP, `db lint`, type generation). `supabase-deploy.yml` pushes migrations to the hosted project on merge once the Supabase secrets exist.

## Layout

```
app/                 the PWA
  src/styles/tokens.css   every color, radius and font (from design/tokens.md)
  src/index.css           Tailwind entry, base styles, dark variant
  src/theme/              theme preference (system/light/dark) saved per device
  src/pwa/                install prompt and update hooks
  src/lib/                env, typed Supabase client, generated database.types.ts
  src/auth/               AuthProvider (session + profile + restaurants), guards, e2e mock
  src/app/                router, Shell (Outlet + tab bar), roles (homes, tabs)
  src/components/         shared kit, every piece shown on /kit
  src/screens/            one folder per area; errors/ and loading/ hold the boards
  e2e/                    Playwright flows (smoke, frame)
  scripts/icons.mjs       regenerates public/ icons from the mark
  wrangler.jsonc          Cloudflare Worker: serves dist, SPA fallback
supabase/
  migrations/        eight files: types, org+access (can()), equipment, tickets,
                     service+money, walkthroughs, views, storage
  seed.sql           the design's sample data; fixed ids (see the header)
  tests/database/    pgTAP, one file per concern, run by `supabase test db`
  config.toml        local stack; invite-only signup, 12-char passwords, TOTP on
design/              exported design: INDEX.md, tokens.md, screens/*.dc.html + .png
handoff/             build plan, slides, architecture diagram
```

## Design

The design lives in design/. Before building or changing any screen, read its
file in design/screens/<Name>.dc.html and look at design/screens/<Name>.png.
Match it; do not reinterpret it. Styles come only from design/tokens.md.
A phase is done when every screen listed for it in design/INDEX.md renders
on a phone and matches its PNG, in light and dark mode.

- Never copy a hex value out of a screen file into app code. Add or use a token in `app/src/styles/tokens.css` and reference it through Tailwind (`bg-surface`, `text-text-muted`, `rounded-card`) or `var(--…)`.
- The screens are light mode only. Dark values come from `tokens.md` (the proposed set, plus derived values marked in `tokens.css`). Check a new component in both themes on `/kit` before a screen uses it.
- Shared patterns are shared components: a restaurant name with its color square is `RestaurantName`; a status with an icon is `StatusPill`. Build once in `app/src/components`, use everywhere.
- `href` values between screen files are the routes. `data-props` on a screen lists its alternate states.

## App frame

- Routes follow the design's href links: manager `/tickets`, `/tickets/new`, `/walkthrough`, `/equipment`; ops `/ops`, `/ops/walkthroughs`, `/ops/equipment`, `/ops/contractors`; admin `/admin/users`, `/admin/roles`, `/admin/tickets`, `/admin/restaurants`; leadership `/lead`, `/lead/restaurants`, `/lead/walkthroughs`, `/lead/contractors`; everyone `/profile`; public `/sign-in`, `/kit`. `src/app/roles.ts` is the one place these live.
- Every signed-in route sits under `RequireAuth` then `RequireRole`, and renders inside `Shell` (tab bar) or `BareShell` (detail screens). Screens use `Screen`, `ScreenHeader`, `ScreenBody`, `BackBar` from `components/Screen.tsx`.
- `useUser()` gives the profile, the restaurants in scope and whether that scope is all restaurants. Data hooks are one TanStack Query hook per screen over the typed client in `lib/supabase.ts`; regenerate `lib/database.types.ts` from the CI artifact (`database-types`) after a schema change.
- `/kit` is public and shows every component in both themes plus the loading and error boards under `/kit/loading/*` and `/kit/errors/*`. A new component goes there first.
- The e2e build sets `VITE_E2E_MOCK=1`: `/sign-in` becomes a role picker over the seed's people and no backend is needed. Production builds never set it.
- Local dev needs `app/.env` with `VITE_SUPABASE_URL` (the Project URL, `https://<ref>.supabase.co`) and `VITE_SUPABASE_ANON_KEY` set to the publishable key (`sb_publishable_…`, Project Settings, API Keys); see `.env.example`. Both are public and get built into the bundle, so never put a secret key (`sb_secret_…`), the legacy `service_role` key or a personal access token (`sbp_…`) in a `VITE_` variable. The same two go in the Cloudflare Worker's build variables, set separately for Production and for each branch (the environment dropdown on Settings, Builds).

## Token names

Surfaces `bg`, `surface`, `surface-sunken`, `surface-muted`, `surface-hover`. Borders `border`, `border-strong`, `border-muted`. Text `text`, `text-body`, `text-secondary`, `text-muted`, `text-faint`. Brand `brand` (links, active tab), `brand-fill` / `brand-fill-hover` / `on-brand` (primary buttons), `brand-strong`, `brand-tint`, `brand-tint-soft`. Semantic `urgent`, `danger`, `danger-fill`, `info`. Status pills `status-{open,progress,waiting,scheduled,reopened,closed,fixed}-{bg,text}`. Fonts `font-display` (Archivo), `font-body` (Public Sans), `font-mono` (JetBrains Mono). Sizes `text-11` … `text-30`. Radii `rounded-card` 14, `rounded-input` 12, `rounded-control` 10, `rounded-segment` 9, `rounded-pill`, `rounded-square` 3, `rounded-tag` 6, `rounded-sheet` 22. Spacing `px-screen` (20px), `min-h-tap` (44px), `pt-safe` / `pb-safe`.

## Phone rules

- Inputs, selects and textareas are 16px, always (iOS zooms on focus otherwise). The base stylesheet sets it; never put a text-size utility below `text-16` on a field. Button labels follow the design (14 to 15px).
- Full-height layouts use `100dvh`, never `100vh`.
- Pad the top and bottom of fixed chrome with the safe-area insets (`pt-safe`, `pb-safe`). The bottom tab bar is `6px 8px` on top and sides; its bottom is the home-bar inset, at least 8px. The design's 20px bottom is its home-bar allowance, so it is replaced, not added to.
- Tap targets are at least 44px. Primary buttons are 52px tall, secondary 48px.
- Screen padding is 20px on the sides, 12 to 16px between cards.

## Permissions

The JWT carries only the user id. One SQL function `can(action, restaurant_id)` reads `profiles.role`, `memberships` (scope: a row per restaurant, or one null row for all) and `rights` (role defaults plus per-person overrides) and is used by every RLS policy. Never add a second permission code path in the app; the UI may hide a control, but the database is what enforces it. Edge Functions run with the service key and must check the caller themselves.

Right keys, from the Roles & rights screen: `create_tickets`, `see_all_tickets`, `update_status`, `log_cost`, `see_costs`, `edit_equipment`, `see_contractors`, `set_walkthrough_schedule`, `invite_users`, `manage_rights`. Admin-only actions that are not in the grid (restaurants, memberships) check `is_admin()`.

What a manager may do to a ticket is enforced by the `tickets_guard` trigger, not by the app: edit text while open, close with a resolution, reopen within 30 days. Assigning and the other statuses need `update_status`. System events in the thread come from the `tickets_log_events` trigger; people insert `message` rows only.

Account creation is invite only at the database level: `handle_new_user` takes role and restaurants from a pending `invites` row matched on email, or from `app_metadata` (service role only), and rejects the insert otherwise. Never read privilege from `user_metadata`; clients can write it. Deactivation (`profiles.deactivated_at`) is enforced inside `has_scope()`, `my_role()` and `can()`, so every policy honors it; the Phase 1 revoke-user function must also ban the auth user so refresh tokens stop working. Keep "Allow new users to sign up" off in the hosted project's Auth settings as defense in depth.

Costs are a separate axis: `service_records`, line items, invoices and the cost views return rows only with `see_costs` at that restaurant. Views are `security_invoker`, so they inherit this.

Seeded sign-ins (local only, password `ontrack-demo-2026`): maya.reyes@ (manager, Logan Square, has see_costs and edit_equipment overrides), ari.kim@ (manager, Ranalli's), bert.velilla@ and chris.novak@ (ops), lee.chen@ (leadership), admin@ (admin), all `@example.com`.

## Working method

Inside a phase: migration and policies with pgTAP first, then one TanStack Query hook per screen, then the screens against the design (new components on `/kit` first), then one Playwright flow for the done test, then try the preview URL on a phone.

- Branches are `OT-<n>` (one PR each). Small PRs: one screen or one function. Merge to `main` only when CI is green.
- Commit messages: imperative, one line of what and why.
- No restaurant data in the repo; the seed is fictional except restaurant names and colors.
- Secrets live only in Supabase and GitHub Actions settings. Never commit a `.env`.
- Each phase ends with a short note of what changed and what the client should try.

## Current phase: 1 · Accounts and access

Done when an admin invites a manager from a phone, the manager sets up the account from the email on another phone, and the RLS tests show the manager sees only their restaurant. Granting `see_costs` to that manager in Roles & rights changes what the database returns, with no app change.

| PR    | Scope                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------- |
| OT-6  | Sign in for real, Signed out and Link expired screens, Profile, Help & support                        |
| OT-7  | Admin Restaurants and Add restaurant (accent presets, custom color, taken-color check)                |
| OT-8  | Invites: `send-email`, `invite-user`, `revoke-user`, Users, Invite user, invite email, Set up account |
| OT-9  | Password reset 1 to 5 (Supabase auth email through Resend SMTP)                                       |
| OT-10 | Roles & rights grid, User profile overrides, View as with the audit log                               |
| OT-11 | 2-step verification (TOTP), required for admins                                                       |

Email goes through Resend. Until the group has a sending domain, the sender is `onboarding@resend.dev`, which only delivers to the Resend account's own address.

## Database work

No Supabase CLI or Docker on the dev machine, so the database is verified in CI: push the branch and read the `Database` job. To run it locally when Docker is available: `npx supabase db start && npx supabase test db`. Add a migration as a new timestamped file; never edit one that is on `main`. Every new table gets RLS, policies that go through `can()`, and a pgTAP file. Keep the seed in step with the design's sample data.

## Commands

```sh
cd app
npm ci
npm run dev            # http://localhost:5173
npm run lint && npm run typecheck && npm test
npm run test:e2e       # builds, then Playwright on Chromium + WebKit
npm run format         # Prettier
```
