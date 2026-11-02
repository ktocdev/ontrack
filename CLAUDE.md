# OnTrack

Mobile-first PWA for equipment and repair tickets across the Four Corners restaurants. One person builds it with AI help, so every session starts from this file. The full plan is `handoff/OnTrack - Build Plan.md`; read the current phase section before starting work.

## Stack

- **App:** React 19, Vite, TypeScript, Tailwind v4 (tokens as CSS variables), Radix primitives, React Router, TanStack Query over `@supabase/supabase-js`. Installable PWA via `vite-plugin-pwa`.
- **Backend:** Supabase Postgres with row-level security on every table, Supabase Auth (email + password, invite only, TOTP), Supabase Storage, Edge Functions (Deno) only for jobs that need a secret or a server.
- **Hosting:** Cloudflare Workers with static assets (`app/wrangler.jsonc`), connected through Workers Builds: `main` is production, every other branch gets a preview URL and a PR comment.
- **Tests:** Vitest for logic, pgTAP for RLS policies, Playwright on Chromium and WebKit for flows. WebKit stands in for an iPhone. Playwright has two suites: `e2e/` runs on the mock build (no backend, runs locally), `e2e/stack/` runs against the seeded local Supabase stack (CI only, since this machine has no Docker).
- **CI:** `.github/workflows/ci.yml` runs on every PR and on `main`, except when only Markdown, `handoff/` or `design/` changed: the app (lint, format check, typecheck, Vitest, build, mock-build Playwright), the flows (`supabase start`, then `e2e/stack` Playwright against it, one job per browser) and the database (`supabase db start`, pgTAP, `db lint`, type generation, and a diff of the generated types against the committed file). `supabase-deploy.yml` pushes migrations and deploys functions to the hosted project on merge once the Supabase secrets exist.

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
  e2e/                    Playwright on the mock build (smoke, frame, kit, profile)
  e2e/stack/              Playwright against the seeded local stack (playwright.stack.config.ts, CI only)
  scripts/icons.mjs       regenerates public/ icons from the mark
  wrangler.jsonc          Cloudflare Worker: serves dist, SPA fallback
supabase/
  migrations/        one file per change; the first eight are types, org+access (can()), equipment, tickets,
                     service+money, walkthroughs, views, storage
  functions/         Edge Functions: invite-user, revoke-user, reset-two-step, send-email, _shared/
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

- Routes follow the design's href links: manager `/tickets`, `/tickets/new`, `/walkthrough`, `/equipment`; ops `/ops`, `/ops/walkthroughs`, `/ops/equipment`, `/ops/contractors`; admin `/admin/users`, `/admin/roles`, `/admin/tickets`, `/admin/restaurants`; leadership `/lead`, `/lead/restaurants`, `/lead/walkthroughs`, `/lead/contractors`; everyone `/profile` and a ticket's lasting link `/t/<id>`; public `/sign-in`, `/kit`. `src/app/roles.ts` is the one place these live.
- Every signed-in route sits under `RequireAuth` then `RequireRole`, and renders inside `Shell` (tab bar) or `BareShell` (detail screens). Screens use `Screen`, `ScreenHeader`, `ScreenBody`, `BackBar` from `components/Screen.tsx`.
- `useUser()` gives the profile, the restaurants in scope and whether that scope is all restaurants. Data hooks are one TanStack Query hook per screen over the typed client in `lib/supabase.ts`; after a schema change, copy the CI artifact (`database-types`) into `lib/database.types.ts` exactly as generated (Prettier skips it; CI fails if it drifts).
- `/kit` is public and shows every component in both themes plus the loading and error boards under `/kit/loading/*` and `/kit/errors/*`. A new component goes there first.
- The group is data, not code: another restaurant group may use this app, each on its own deployment and subdomain (`fourcorners.ontrack-app.app`, later `hogsalt.ontrack-app.app`). Read the name and short name from `group_settings`; never write "4C" or "Four Corners" in app code, even where a board shows it. Build links from `APP_URL` in Edge Functions and the current origin in the app, never from a fixed domain.
- The mock e2e build sets `VITE_E2E_MOCK=1`, which becomes the build-time literal `__E2E_MOCK__`: `/sign-in` becomes a role picker over the seed's people and no backend is needed, and production bundles drop that code entirely. Data hooks have no mock path: a flow that reads or writes data is tested in `e2e/stack/`. Production builds never set it, and `vite.config.ts` refuses the flag under Workers Builds (`WORKERS_CI`).
- Every build writes `dist/_headers` (from `vite.config.ts`): a content security policy that allows only this origin, the Supabase project and the hashed theme script in `index.html`, plus the frame, sniffing, referrer and transport headers. A new external origin (a font host, an API) must be added there, and a CSP change is checked on the branch preview, since Playwright does not go through Cloudflare.
- Local dev needs `app/.env` with `VITE_SUPABASE_URL` (the Project URL, `https://<ref>.supabase.co`) and `VITE_SUPABASE_ANON_KEY` set to the publishable key (`sb_publishable_…`, Project Settings, API Keys); see `.env.example`. Both are public and get built into the bundle, so never put a secret key (`sb_secret_…`), the legacy `service_role` key or a personal access token (`sbp_…`) in a `VITE_` variable. The same two go in the Cloudflare Worker's build variables, set separately for Production and for each branch (the environment dropdown on Settings, Builds).

## Token names

Surfaces `bg`, `surface`, `surface-sunken`, `surface-muted`, `surface-hover`. Borders `border`, `border-strong`, `border-muted`. Text `text`, `text-body`, `text-secondary`, `text-muted`, `text-faint`. Brand `brand` (links, active tab), `brand-fill` / `brand-fill-hover` / `on-brand` (primary buttons), `brand-strong`, `brand-tint`, `brand-tint-soft`, `brand-tint-faint`. Semantic `urgent`, `danger`, `danger-fill`, `info`. Status pills `status-{open,progress,waiting,scheduled,reopened,closed,fixed}-{bg,text}`. Fonts `font-display` (Archivo), `font-body` (Public Sans), `font-mono` (JetBrains Mono). Sizes `text-11` … `text-30`, plus `text-17`, `text-18`, `text-26`, `text-28`, `text-40` from the boards. Radii `rounded-card` 14, `rounded-input` 12, `rounded-track` 11, `rounded-control` 10, `rounded-segment` 9, `rounded-pill`, `rounded-tag` 6, `rounded-chip` 5, `rounded-square` 3, `rounded-sheet` 22, `rounded-cover` 24. Overlays `bg-scrim`; shadows `shadow-raised`, `shadow-dialog`, `shadow-segment`, `shadow-knob`. Spacing `px-screen` (20px), `min-h-tap` (44px), `pt-safe` / `pb-safe`.

## Phone rules

- Inputs, selects and textareas are 16px, always (iOS zooms on focus otherwise). The base stylesheet sets it; never put a text-size utility below `text-16` on a field. Button labels follow the design (14 to 15px).
- Full-height layouts use `100dvh`, never `100vh`.
- Pad the top and bottom of fixed chrome with the safe-area insets (`pt-safe`, `pb-safe`). The bottom tab bar is `6px 8px` on top and sides; its bottom is the home-bar inset, at least 8px. The design's 20px bottom is its home-bar allowance, so it is replaced, not added to.
- Tap targets are at least 44px. Primary buttons are 52px tall, secondary 48px.
- Screen padding is 20px on the sides, 12 to 16px between cards.

## Permissions

The JWT carries only the user id. One SQL function `can(action, restaurant_id)` reads `profiles.role`, `memberships` (scope: a row per restaurant, or one null row for all) and `rights` (role defaults plus per-person overrides) and is used by every RLS policy. Never add a second permission code path in the app; the UI may hide a control, but the database is what enforces it. Edge Functions run with the service key and must check the caller themselves.

Right keys, from the Roles & rights screen: `create_tickets`, `see_all_tickets`, `update_status`, `log_cost`, `see_costs`, `edit_equipment`, `see_contractors`, `set_walkthrough_schedule`, `invite_users`, `manage_rights`. Admin-only actions that are not in the grid (restaurants, memberships) check `is_admin()`.

What a manager may do to a ticket is enforced by the `tickets_guard` trigger, not by the app: edit text while open, close with an optional comment, reopen within 30 days through `reopen_ticket`, which also posts the required reason. A reopened ticket acts like a new one apart from its badge: the guard takes off the assignee and any date, and Ops has no separate steps for it. A closed ticket takes no message or photo from anyone without `update_status`. Nobody assigns a ticket in the app: `assignee_id` holds who is working on it, set through `set_ticket_status` and `take_ticket`, which need `update_status`. System events in the thread come from the `tickets_log_events` trigger; people insert `message` rows only.

Account creation is invite only at the database level: `handle_new_user` takes role and restaurants from the pending `invites` row whose `token_hash` matches `user_metadata.invite_token` and whose email matches (the accept step of `invite-user` creates the auth user with it, because Supabase Auth's admin API writes `app_metadata` only after the insert, then removes it), or named by `app_metadata.invite_id`, or from `role` and `restaurant_ids` in `app_metadata` (seed, accounts made by hand), and rejects the insert otherwise. Only the service role writes `app_metadata`; an email alone never claims an invite, so the dashboard's Add user no longer creates a profile. Never read privilege from `user_metadata`; clients can write it. The token only proves the link is held; what it grants comes from the invite row. pgTAP inserts into `auth.users` directly, so anything that depends on how Auth creates a user also needs a test in `e2e/stack`. Deactivation (`profiles.deactivated_at`) is enforced inside `has_scope()`, `my_role()` and `can()` and in the own-row write policies, so every policy honors it; the revoke-user function must also ban the auth user so refresh tokens stop working. Keep "Allow new users to sign up" off in the hosted project's Auth settings as defense in depth.

Rights change through `save_role_defaults` and `set_person_rights`, and role and restaurants through `set_person_access`, each checking the caller and logging. The `rights_guard` trigger locks admin rights in the database, and stops anyone but an admin touching `manage_rights`, `invite_users` or `see_all_tickets`, their own overrides or their own role's defaults. A switch that matches the role's default stores no override.

View as is not impersonation: no token changes hands and the database still answers as the admin. What changes is `useUser()`, which returns the person viewed with `viewingAs` set. So every screen that loads data must scope it from `useUser()`, never from what the database would let the signed-in admin read, and every screen that writes must hide its controls when `viewingAs` is set. Each new home screen also replaces its placeholder in `ViewAsScreen`.

`invites` are read with `invite_users` and written only by the service role: `invite-user` and `revoke-user` check the caller with `can('invite_users')`, and anyone but an admin may act only on managers (or invites for managers) inside their own restaurant scope, since those writes bypass RLS and every other role sees across restaurants. Triggers that gate on `is_admin()` (`protect_profile_columns`) also pass `is_service()`, the service role or the database owner with no signed-in user, so Edge Functions can set `deactivated_at`. `audit_log` rows are written by admins and holders of `manage_rights` or `invite_users`, as themselves; a `rights` write sets `updated_by` to the caller. `profiles.avatar_path` must sit under `<user id>/`, names are 1 to 120 characters, phones at most 40.

Password change re-checks the current password by signing in on a separate throwaway client, because signing in on the app's own client would swap the session for a new one with no second step behind it. `secure_password_change` is on in `config.toml` and must be on in the hosted project (Authentication, Settings); the 12-hour cap keeps every session inside its 24-hour recent-login rule.

2-step verification is enforced in the database, since a redirect would not stop someone calling the API with a stolen password. `two_step_ok()` is false for a session that owes its second step: anyone with a verified factor at `aal1`, and anyone who must have 2-step (`two_step_required()`: an admin, an unanswered reset, or backup codes with no factor) but has no factor. It trusts `aal2` and passes only alongside a verified factor, and refuses any token issued up to the person's `two_step_resets.reset_at`, since an access token says aal2 for up to an hour after Auth has lowered its session. `my_role()`, `has_scope()` and `can()` answer through it, so a session that owes a step reads nothing, not even its own profile; `two_step_status()` is how the app learns what is owed, and `RequireAuth` shows the code or setup screen on the route that was asked for. So the JWT carries the user id and Auth's own `aal` and `session_id`; nothing else. A new policy that matches on `auth.uid()` alone skips this, so it also checks `my_role() is not null`. Auth has no backup codes or remembered devices, so `use_backup_code` and `use_remembered_device` record a pass for that one session in `two_step_passes`, which `two_step_ok()` accepts. The token stays `aal1`, and Auth still refuses a password change without `aal2`, so Change password and the reset link ask for an authenticator code, and `new_backup_codes` wants a real `aal2` too. A remembered phone can be set only at a real `aal2` and spent only by a session signed in with a password (the JWT's `amr`), so a reset link cannot use one. An admin resets someone through `reset-two-step`, which writes a `two_step_resets` row, removes the codes, devices, passes and factor, and ends their sessions through `end_sessions()` (service role only), so they set it up again whatever their role; nobody resets their own. The row stays once answered, since its `reset_at` is the cut-off. A new password or a deactivation ends remembered phones and passes, by trigger so every path is covered (`two_step_forget_on_password` on `auth.users`, `two_step_forget_on_deactivate` on `profiles`), and `revoke-user` also ends sessions on deactivate, since a ban only pauses refresh tokens. Removing your own authenticator through Auth's API can't be stopped, but having codes with no factor makes setup required again. Ten wrong backup codes in 15 minutes stop further tries, which also stops the real owner's backup codes for that time, though the authenticator still works. Auth accepts a TOTP code more than once and the previous window's too, which the app cannot change, so one seen code is one `aal2` session; that is why none of these may turn into lasting access. `is_admin()` always answers true or false; `can()` too. pgTAP's `login` helpers carry `'aal', 'aal2'`, and `e2e/stack/helpers.ts` answers the seeded admin's code from the secret in `seed.sql`. If the only admin loses their phone and codes, nobody in the app can reset them; in the Supabase SQL editor: `delete from auth.mfa_factors where user_id = '<their id>'`. They then set it up again at next sign-in.

Ticket photos live under `<ticket id>/` in `ticket-photos`, and the file follows its note: `can_see_ticket_photo()` keeps a photo on an internal note from anyone who can't read the note, since listing the ticket's folder would otherwise reach it. Messages with photos go through `post_ticket_update`, so a failure leaves neither. Leadership writes nothing in a thread.

In-house tasks are added by insert and changed only through `set_inhouse_fix_done` and `delete_inhouse_fix`. Unlike the archive and delete reference, these two are `security definer` and check `can('create_tickets')` themselves, because a manager can't write `audit_log` and a delete the API could reach directly would skip the log. A delete removes the row, only while the task is open.

Costs are a separate axis: `service_records`, line items, invoices and the cost views return rows only with `see_costs` at that restaurant. Views are `security_invoker`, so they inherit this.

Avatars: initials follow the boards, with the color from the role and from the invite state on pending and expired rows. `group_settings` also holds the group-wide profile photo switch; off is enforced in the `avatars` storage policies and on `profiles.avatar_path`, not only by hiding the buttons, and a person can still remove their own photo, so their own stays readable to them because Storage reads a file to remove it. It covers profile photos only, not ticket or equipment photos. Every avatar goes through `useAvatarUrl`, which returns nothing when off. A signed URL already handed out works until it expires, within the hour.

`group_settings` cannot be written through the API, so nothing skips the log: `save_group_name` and `set_profile_photos` check for an admin and write `audit_log`.

Seeded sign-ins (local only, password `ontrack-demo-2026`; admin@ also needs a code for the authenticator secret `JBSWY3DPEHPK3PXP`): maya.reyes@ (manager, Logan Square, has see_costs and edit_equipment overrides), ari.kim@ (manager, Ranalli's), dana.ortiz@ (manager, Porter), bert.velilla@ and chris.novak@ (ops), lee.chen@ (leadership), admin@ (admin), all `@example.com`.

## Archive and delete

One rule for every entity: **things people pick from can be archived; records of what happened are never archived or deleted, only corrected; anything can be deleted only while nothing points to it yet.**

| Entity                                                       | Archive (reversible)                                                                                                                    | Delete                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Restaurants                                                  | Archive / Restore (`archived_at`): out of every list and picker, refuses new work                                                       | Only with no tickets, equipment, walkthroughs or in-house fixes, and nobody's home |
| People                                                       | Deactivate / Reactivate (`deactivated_at`, plus the auth ban in `revoke-user`): no sign-in, out of pickers, name stays on their history | A pending invite is revoked; an account only with no history at all                |
| Equipment                                                    | Retire (`retired_at`)                                                                                                                   | Only with no tickets or service records                                            |
| Contractors                                                  | Archive (`archived_at`)                                                                                                                 | Only with no service records                                                       |
| Categories, walkthrough templates and items, quarterly tasks | Turn off (`active`)                                                                                                                     | Only if never used                                                                 |
| Tickets                                                      | None: closing ends a ticket                                                                                                             | Never; a mistaken ticket is closed with a note                                     |
| Walkthroughs, ticket updates, service records, invoices      | None: they are the record                                                                                                               | Never; mistakes are edited, and the edit is logged                                 |
| In-house fixes and tasks                                     | None                                                                                                                                    | While still open, as the boards show                                               |

How to build one (OT-9's restaurants are the reference): a `security invoker` SQL function per action that checks the caller first, writes an `audit_log` row and does the change in one step; the "only while empty" rule enforced in that function from a `security_invoker` history view, not only in the UI; a guard on inserts so an archived thing takes nothing new; archived rows filtered out of pickers but still readable; a sheet on the row with the action and a confirm step that says what happens, and Delete disabled with the reason when it is not allowed; pgTAP for the role check, the refusal and the log.

## Working method

Inside a phase: migration and policies with pgTAP first, then one TanStack Query hook per screen, then the screens against the design (new components on `/kit` first), then one Playwright flow for the done test in `e2e/stack`, then try the preview URL on a phone.

A screen that needs real data can only render against the stack, which runs in CI. Its `e2e/stack` test attaches screenshots (`testInfo.attach`), and each Flows job always uploads its report: download it with `gh run download <run> -n playwright-report-stack-chromium` (or `-webkit`) and compare the attachments with the board's PNG.

- Branches are `OT-<n>` (one PR each). Small PRs: one screen or one function. Merge to `main` only when CI is green.
- A small fix that touches no database, auth or data flow may open with the `quick` label (`gh pr create --label quick`), which skips the Flows jobs on the PR. Run the flows it touches locally first. `main` still runs them after the merge, so check that run. The label must be on the PR when it opens or be followed by a push.
- Commit messages: imperative, one line of what and why.
- No restaurant data in the repo; the seed is fictional except restaurant names and colors.
- Secrets live only in Supabase and GitHub Actions settings. Never commit a `.env`.
- Each phase ends with a short note of what changed and what the client should try.

## Current phase: 3 · Ops dashboard and ticket work

The plan's Phase 3 section says what ships. Done when a manager creates a ticket and the ops manager's phone buzzes; the ops manager marks it In progress, posts an update the manager sees, and closes it with a comment; the manager reopens it and Ops sees Reopened on the dashboard. Playwright checks who was sent what; the buzz itself is tried by hand on a real phone.

| PR    | Scope |
| ----- | ----- |
| OT-36 | Plan update and this split |
| OT-37 | Ops dashboard: Open tab, All / Mine, the restaurant picker that scopes every Ops screen, cards, empty state, loading skeleton; replaces the ops placeholder in View as |
| OT-38 | Saved for later: the dashboard's filter sheet, unless Ops asks for it |
| OT-39 | Ops ticket detail: header, description, photos, equipment card, the status dropdown, marking In progress puts you on it, Take this over, a date for Scheduled |
| OT-40 | Ops thread: composer with photos, the internal-note toggle, Close ticket with a comment |
| OT-41 | Closed tickets, opened from the dashboard's menu: grouped by month with totals, its empty state, closed ticket detail |
| OT-42 | Dropped from feedback (Nov 2, 2026): a reopened ticket has no screen or sheets of its own; see OT-52 |
| OT-43 | Lasting link `/t/<id>` for every role, and Share link on a ticket |
| OT-44 | Push on a device: service worker handles push, subscribe per device, the Notifications section on Profile, a test push to your own phone |
| OT-45 | `send-push`: database triggers for each kind, who gets what, email for anyone with no subscription, links through `/t/<id>` |
| OT-46 | Put back the boards' notification promises; check on BrowserStack how an iPhone opens a link; a temporary ring on a new ticket's card, for Ops and managers |
| OT-48 | Simplify the dashboard from feedback: no assigning, no Unassigned, no All / Mine; a badge names who is working on a ticket |
| OT-49 | Tickets grouped under a label for each restaurant; Closed moves to an ellipsis menu; a reopened ticket is an ordinary card with its pill |
| OT-50 | Change the order of the restaurants on the dashboard by dragging |
| OT-51 | From feedback: a reopened ticket is on the dashboard and not in Closed tickets; the Ops message box hidden until Add update; no "Nobody has this yet" note |
| OT-52 | From feedback: a reopened ticket acts like a new one apart from its badge, with nobody on it and no date |
| OT-55 | Security audit of what Phase 3 added: policies and functions since OT-22, internal notes and their photos, Ops and manager scope, links, push and `send-push` |
| OT-56 | Code quality pass: the repeated ticket header, the similar closed-ticket screens, `v_closed_by_month` that nothing uses, leftovers from simplifying |
| OT-47 | The done test as one flow; the phase note |

## Phase 2, for the record

The plan's Phase 2 section says what shipped and what it works around.

Done when a manager at Federale's Logan Square creates a ticket with a photo on a phone, it appears in the database with the right restaurant, and a second manager at Porter cannot see it. Ops sees tickets only through the database until Phase 3.

| PR    | Scope |
| ----- | ----- |
| OT-24 | Plan update and this split |
| OT-25 | Default categories in a migration (the hosted project has none); Open tickets list, search, Front / Back segments, empty and no-results states, the ticket card |
| OT-26 | Create ticket: area and category, then the form with the equipment picker; the save-failed state |
| OT-27 | Ticket detail: header, description, equipment card, thread with system events, text composer |
| OT-28 | Photos: resize to 1600 px, add on the form and in the composer, thumbnails in the thread |
| OT-29 | Edit and close, Closed ticket, the Reopen sheet, cost shown only with `see_costs` |
| OT-30 | In-house tab: list, check off, delete while open |
| OT-31 | The done test as one flow; the phase note |
| OT-32 | From trying OT-26 live: Open tickets loads in the empty layout when it found nothing last time, so it doesn't jump |
| OT-33 | From OT-29's open questions: an ellipsis menu beside the search on Open tickets with View Closed Tickets, opening a simple list; Title on Edit ticket |
| OT-34 | From trying Phase 2 live: no scrollbar on the message field at one line |
| OT-35 | Faster CI: docs-only PRs run nothing, the flows run one job per browser, and a `quick` label skips them on a small fix's PR |

## Phase 1, for the record

Done when an admin invites a manager from a phone, the manager sets up the account from the email on another phone, and the RLS tests show the manager sees only their restaurant. Granting `see_costs` to that manager in Roles & rights changes what the database returns, with no app change.

| PR    | Scope                                                                                                                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OT-6  | Sign in, Signed out sheet (12-hour cap, app side), Profile, Help & support, support reports                                                                                                                    |
| OT-7  | Security audit of OT-6 and the OT-2 access layer: invite claim by id, invites service-role only, `is_service()`, deactivated write paths, audit log writers, CSP headers                                       |
| OT-8  | Code quality pass: real report on the 500 screen, auth load errors, mock code out of production, Playwright against the local stack for data flows, type drift check, lazy routes, token and component cleanup |
| OT-9  | Admin Restaurants and Add restaurant (accent presets, custom color, taken-color check)                                                                                                                         |
| OT-10 | Group name in `group_settings`, then invites: `send-email`, `invite-user`, `revoke-user`, Users, Invite user, invite email, Set up account, Link expired                                                       |
| OT-11 | Password reset 1 to 5 (Supabase auth email through Resend SMTP), reset links on Sign in and Help                                                                                                               |
| OT-12 | Roles & rights grid, User profile overrides, View as with the audit log                                                                                                                                        |
| OT-13 | 2-step verification (TOTP), required for admins                                                                                                                                                                |
| OT-15 | Fixes from trying OT-11 live: form errors clear on the next edit, Resend confirms, no signing in through a URL                                                                                                 |
| OT-14 | Group settings on Roles & rights: edit the group name; profile photo switch (off refuses uploads and hides existing photos, on restores them)                                                                  |
| OT-16 | Reload fix: `html_handling: none`, so the service worker's fallback never meets a redirect |
| OT-17 | 2-step wording: the QR code is for someone on a computer, not a second phone |
| OT-18 | Profile confirms a photo saved or removed |
| OT-19 | Phase 1 note and status |
| OT-20 | 2-step audit fixes: a reset ends live sessions, reset links cannot use a remembered phone, removing your own authenticator does not turn it off |
| OT-21 | 2-step audit fixes: a new password or deactivation ends remembered phones, passes and sessions |
| OT-22 | 2-step audit fixes: signed-out visitors run no database functions, checked in CI |
| OT-23 | Fixes from trying Phase 1 live: no near-color warning, Edit restaurant, signing back in after Sign out goes home, a refresh says Loading, no fallback email sender |

Email goes through Resend. `EMAIL_FROM` names the sender, on a domain verified with Resend; there is no fallback, so without it sending fails and the function log says why. Function secrets live in the hosted project (Edge Functions, Secrets): `RESEND_API_KEY`, `APP_URL`, `EMAIL_FROM` and `SUPPORT_EMAIL`. Locally, `config.toml` sends mail to the stack's Mailpit inbox (http://127.0.0.1:54324), and `e2e/stack` reads the invite and reset links from there.

Auth's own emails are set per project: `supabase/templates/` is what `config.toml` uses locally, and the hosted project needs the same files pasted in (Authentication, Emails), since no deploy pushes them, along with the 1800-second email OTP expiry and the password-changed notification. The reset template's link carries `token_hash` in its fragment, and the app spends it when `/reset/new` opens, so a mail scanner fetching the link cannot use it up. Only that link opens the new-password form.

## Database work

Docker Desktop runs on the dev machine, so the database and the data flows are checked locally before pushing (CI checks them again): `npx -y supabase@2.122.0 start -x studio,imgproxy,logflare,vector,realtime,postgres-meta`, then `npx -y supabase@2.122.0 test db`, then `npm run test:e2e:stack` in `app/` with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY` set to the `PUBLISHABLE_KEY` the start command prints. `npx -y supabase@2.122.0 db reset` puts the seed back. A new Edge Function, or a change to `config.toml`, needs `supabase stop` and `start` before it is served. Use the same CLI version as CI. Add a migration as a new timestamped file; never edit one that is on `main`. Every new table gets RLS, policies that go through `can()`, and a pgTAP file. Every new function ends with `revoke all on function … from public, anon`, then its own grants, because Supabase grants `anon` every new function by default; `18_anon_functions.test.sql` fails CI on one left open. Keep the seed in step with the design's sample data.

## Commands

```sh
cd app
npm ci
npm run dev            # http://localhost:5173
npm run lint && npm run typecheck && npm test
npm run test:e2e       # builds the mock build, then Playwright on Chromium + WebKit
npm run test:e2e:stack # needs `supabase start` and VITE_SUPABASE_* pointed at it (CI runs it)
npm run format         # Prettier
```
