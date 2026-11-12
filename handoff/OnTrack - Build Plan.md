# OnTrack — Build Plan

Oct 28, 2026 · Katie · updated Nov 5, 2026 with Phase 1 as built (2-step verification, the profile photo switch, the group name as data, per-group domains), Phase 2 and Phase 3 as built, the Phase 3 security audit and the Phase 4 pull requests

## How to read this

This is the build order for OnTrack: nine phases, each one a working slice of the app that can be tried on a phone before the next starts. The [Stack & Build Plan](https://claude.ai/artifact/B75SBPJobgaH5nAWhBCU9t) from October 20 holds the pre-design exploration (why a PWA, why Supabase, the auth alternatives, storage costs); this doc supersedes its phases and stack table.

The goal of the first four phases is one thing: an app the Four Corners ops team can install on their phones and use for real tickets, because a working app will land better than the slides and the design canvas have. Everything in the design (about 110 screens) is covered by a phase here; nothing is dropped, only ordered.

Each phase lists what it ships, the screens it covers from the design, the backend it needs, and a done test. Screens are named as they are on the design board so you can open them side by side.

## Status

| Phase | State | Pull requests |
| --- | --- | --- |
| 0 · Foundation | Done, except the real-iPhone check | OT-1 scaffold, tokens, theme, PWA, CI · OT-2 schema, RLS, `can()`, pgTAP, seed · OT-3 component kit, app frame, auth guard, role shells, loading and error boards |
| Kit pass | Done | OT-4 plan update · OT-5 every kit component gets its full set of states in both themes; the `/kit` page gets a desktop layout |
| 1 · Accounts and access | Done, except the real-iPhone check | OT-6 Sign in, signed out, Profile, Help · OT-7 security audit · OT-8 code quality · OT-9 Restaurants · OT-10 invites and the group name as data · OT-11 password reset · OT-15 fixes from trying reset live · OT-12 Roles & rights, User profile, View as · OT-16 reload fix · OT-13 and OT-17 2-step verification · OT-14 and OT-18 group settings and photo messages · OT-20, OT-21 and OT-22 fixes from the 2-step security audit |
| OT-23 | Done, tried on the live app | Small fixes from trying Phase 1 live, before Phase 2 (see below) |
| 2 · Tickets, the manager loop | Done, except the real-iPhone check | OT-24 plan update, then OT-25 to OT-35 (see Phase 2) |
| 3 · Ops dashboard and ticket work | Done, except the real-iPhone checks | OT-36 plan update, then OT-37 to OT-64 (see Phase 3). The buzz and its badge were tried on Android (Nov 5, 2026). Google sign-in (OT-59) is deferred until the group's IT person is involved |
| 4 · Equipment · first demo | Done, except the real-iPhone checks; tried on the live app (Nov 11, 2026) | OT-65 plan update, then OT-66 to OT-88 (see Phase 4). QR labels (OT-74) are deferred until the iPhone link check |
| 5 · Contractors, service records and invoices | Split into pull requests (Nov 11, 2026) | OT-89 plan update, then OT-90 to OT-98 (see Phase 5) |

Phase 0 notes:

- Production is https://ontrack-app.app (domain bought and connected Oct 2026) and still answers at https://ontrack.katina-sunrise.workers.dev; each branch previews at `https://<branch>-ontrack.katina-sunrise.workers.dev`. `fourcorners.ontrack-app.app` is connected (Oct 30, 2026), and Four Corners installs from there.
- The hosted Supabase project has the full schema (migrations deploy on merge) and no seed data. One admin account exists, made by hand before OT-7: an `invites` row in the SQL editor, then Authentication, Add user with the same email. An invite is claimed only with its link's token or its id in `app_metadata`, which the dashboard cannot set, so the invite flow (OT-10) is the way to add people; by hand means an `auth.users` insert like the seed's, with `role` in `app_metadata`.
- Install and dark mode were checked on Android Chrome. The iPhone part of the done test waits for a try on a real iPhone; Playwright WebKit covers it in CI until then.

Phase 1 note (Oct 30, 2026):

- **What changed:** real accounts. An admin invites someone by email and chooses their role and restaurants; they set up their own account from the link. Sign in, password reset, Profile and Help & support all work. An admin manages restaurants, people, role defaults and one person's rights, can view the app as someone else (read-only and logged), and can rename the group or turn profile photos off. 2-step verification is required for admins and offered to everyone.
- **Security audit:** an independent audit of 2-step verification and group settings (Oct 30, 2026) found 11 issues. OT-20 to OT-22 fix them, except that Supabase accepts a 2-step code more than once, which the app cannot change, and ten wrong backup codes briefly stop the owner's own backup codes too.
- **Security fixes tried on the live app (Oct 31, 2026):** an admin reset ended a test account's live session, and setting up again gave 8 new codes (OT-20). A remembered browser skipped the code, changing the password took a code, and signing in afterwards asked for one again (OT-21). An invite to a new address sent, and its link opened signed out in a private window (OT-22).
- **What that testing turned up:** the `EMAIL_FROM` function secret on the hosted project was missing or still the test sender, so Resend refused invites to anyone but the account's own address. It is set now.
- **OT-23 (Oct 31, 2026):** the fixes that testing led to were tried on the live app and work: Edit restaurant, no near-color warning, signing back in after Sign out goes home, a refresh says Loading, and no fallback email sender.
- **What the client should try:** accept an invite on a phone, sign in, and look at Profile. Change a password, or turn on 2-step verification from Profile. Screens past that are placeholders until Phase 2, and Four Corners has no accounts yet, so this waits until its first admin is chosen (see Open items).
- **How the done test went:** an invite went out and the account was set up from the email on a second phone, against the live app. Turning on See costs for that manager saved as an override, but changes nothing a person can see yet: no screen shows costs until the Closed ticket in Phase 2, and the live project has no cost records. That the database then returns costs is proven on the seeded data, in `e2e/stack/people.spec.ts` and pgTAP, as are the manager seeing only their restaurant and the refusals behind 2-step and the photo switch.

Phase 2 note (Nov 1, 2026):

- **What changed:** a manager can report a problem from a phone and follow it to closed. Open tickets has search and Front / Back. Create ticket goes from area and category to a form with equipment, urgency and photos, shrunk to 1600 px in the browser. A ticket has its thread with system events and a composer. Edit changes the title, description, equipment and urgency, and closes with an optional comment. A closed ticket is read-only and can be reopened within 30 days with a reason; after that it offers a new ticket linked to the old one. The ellipsis menu beside the search leads to a list of closed tickets. The In-house tab checks tasks off and deletes them while open. Cost and contractor show on a closed ticket only with See costs.
- **What the client should try:** sign in as a manager on a phone, create a ticket with a photo, post an update, then close and reopen it. Ops can't see tickets in the app until Phase 3, and Four Corners has no accounts yet, so this also waits until its first admin is chosen (see Open items).
- **What can't be tried on the live app yet:** nothing adds equipment until Phase 4, so the picker is empty there, and nothing adds in-house tasks until Phase 6, so the In-house tab is empty. Nothing notifies anyone until Phase 3. The seeded stack shows the full boards.
- **How the done test went:** `e2e/stack/done-phase-2.spec.ts` runs it on Chromium and WebKit against the seeded stack: Maya at Logan Square creates a ticket with a photo, the database has it at her restaurant with the photo under the ticket, and a manager at Porter can't find it in the list, by search or by link, or read it or sign its photo through the API. It was then tried on a real phone against the live app (Nov 1, 2026): a manager at Logan Square created a ticket with a photo, a manager at Porter did not see it in the list or by search, and the table editor showed the right restaurant. The iPhone part waits for a real iPhone, as in Phases 0 and 1.

Phase 3 note (Nov 4, 2026):

- **What changed:** the ops managers can run their day in the app. The dashboard lists every restaurant's open tickets under a label for each, in an order each person can drag, with a picker that scopes every Ops screen and a badge naming anyone else on a ticket. A ticket has a status menu: In progress puts you on it, Take this over is for a colleague's, and Scheduled asks for a date. Ops writes to the restaurant or in internal notes, with photos, and closes with a comment. Closed tickets are grouped by month, with totals for anyone with See costs. A reopened ticket is an ordinary one with a Reopened badge and nobody on it. Each ticket has a lasting link, `/t/OT-1042`, and Share link. Push on each device, email as well on by default, and switches per kind on Profile tell people what happened, and lists change as tickets do. A new ticket has a ring for 5 minutes. From feedback along the way: no assigning, a manager's Open tickets with a shorter header, Show / Hide on passwords, and an Update bar that says it is updating. A security audit (OT-55) and a code quality pass (OT-56) came last.
- **What the client should try:** the ops manager installs the app on a phone, turns on Push notifications on this device in Profile, and a manager at one restaurant creates a ticket. The phone should buzz within seconds, and the email arrive. Then mark it In progress, post an update, close it with a comment, and have the manager reopen it. This waits until Four Corners has accounts (see Open items).
- **What can't be tried on the live app yet:** the equipment card and the walkthrough line open nothing until Phases 4 and 6, costs stay empty until Phase 5 logs service, and admin and leadership have no ticket screens until Phase 7, so a ticket link tells them so. Google sign-in waits for the group's IT person.
- **How the done test went:** `e2e/stack/done-phase-3.spec.ts` runs it on Chromium and WebKit against the seeded stack. Dana at Porter creates a ticket, and Bert is sent a push and an email, and Chris an email. Bert marks it In progress, which puts Bert on it and sends Dana a push. Bert's update reaches Dana's screen and phone. Bert closes it with a comment, and Dana is sent a push. Dana reopens it with a reason, Bert is sent a push and Chris an email, and Bert's dashboard shows it Reopened with nobody on it. Playwright can't feel a buzz, so the flow checks the delivery log, and the push to a real phone was tried by hand on Android against the live app (Nov 5, 2026): a manager's new ticket buzzed the ops manager's phone, the status bar showed the check rather than a bell, and Push notifications on this device came back on after signing out and in again. iPhone push and the iPhone link check wait for a real iPhone.

Phase 4 note (Nov 11, 2026):

- **What changed:** every unit has a page and a history. Ops has an equipment list across restaurants with search, a filter sheet, category cards with open-ticket badges and this year's spend; a manager browses their restaurant's units by Front / Back and then category. A unit's page has Details (with the manual and a data plate photo), Tickets, open and closed, and Service & cost for Ops with See costs. Ops, and a manager with Add / edit equipment, add and edit units, and retire, restore or delete them by the archive and delete rule; retired units wait in a closed Retired card. A manager creates a ticket from a unit with the unit filled in, a ticket's equipment card opens its unit, and each unit has a lasting link, `/e/<id>`, and Share link. Ops and admins look after the group's categories. From feedback along the way: swipe down closes a sheet, Submit ticket with no photo asks first and offers Photo tips, a manager adds in-house tasks by hand and older finished ones sit behind Show older, and the app offers to install itself once. A security pass (OT-73) and an independent audit (OT-84) came before the done test, so it covers their fixes.
- **What the client should try:** the demo. Ops enters a restaurant's real equipment through Add equipment (importing waits for Phase 7), with a manual or a data plate photo where there is one. A manager at that restaurant finds a unit by Back of House and its category, creates a ticket from it, and sees the ticket on the unit; Ops sees it on the dashboard and can open the unit from the ticket. Then the assistant ops manager and one restaurant manager install the app and run real tickets for a week. This waits until Four Corners has accounts (see Open items).
- **What can't be tried on the live app yet:** QR labels, scanning and Print QR label wait for OT-74 and the iPhone link check. Service & cost shows its no-service-yet state until Phase 5 logs service, so spend on the lists stays empty. Importing equipment from a spreadsheet waits for Phase 7.
- **How the done test went:** `e2e/stack/done-phase-4.spec.ts` runs it on Chromium and WebKit against the seeded stack. Maya at Logan Square opens Equipment, Back of House and Refrigeration, opens Walk-in Cooler 1 and creates a ticket from it with the unit already chosen; the ticket is under the unit's Tickets tab and opens from there, and Bert's dashboard lists it with the unit on it. Bert adds a unit at Logan Square through Add equipment, and it shows in Maya's Refrigeration card and in the ticket form's picker. Bert retires it, and it leaves both; Maya has Add / edit equipment, so it waits in her Retired card. The demo on the live app was then tried by hand (Nov 11, 2026) and worked as expected. QR labels and the iPhone checks wait for a real iPhone.

## Decisions

The app talks to Supabase directly and Edge Functions handle only the jobs that need a secret or a server. That is the smallest backend that still keeps roles enforced in the database.

| Area | Decision | Why |
| --- | --- | --- |
| Front end | React 19 + Vite + TypeScript, built as an installable PWA | One codebase for phone and desktop; the design is mobile first; installs from Safari and Chrome without an app store |
| Hosting | Cloudflare Workers with static assets, deployed by Workers Builds: `main` is production, every other branch gets a preview URL | Free tier, global CDN, no server to run; the Worker only serves the built files with a single-page fallback, so the backend lives elsewhere. Pages was the first choice; Cloudflare now labels it legacy |
| Database | Supabase Postgres, hosted | Relational data (restaurants, equipment, tickets, service records); row-level security enforces roles |
| Auth | Supabase Auth: email + password, invite-only, TOTP 2-step | Invite flow and MFA built in; the design's sign-in, reset, 2-step and invite screens map onto it directly |
| Data access | The React app reads and writes Supabase over its client library; every table has RLS policies | Fewer moving parts than an API layer; permissions live in one place and are tested as SQL |
| Server logic | Supabase Edge Functions (Deno, TypeScript) for invites, push, imports, QR label PDFs, scheduled jobs | Python was the first thought but is not required; one language across the whole app, and Edge Functions deploy with the Supabase CLI |
| Files | Supabase Storage, photos resized to 1600 px in the browser before upload | Same permission rules as the tables; invoices and photos stay small |
| Email | Resend, through Supabase's custom SMTP setting plus a sending Edge Function | Supabase's built-in email is rate limited to a few per hour |
| Push | Web Push (VAPID keys), subscriptions stored per device, sent from an Edge Function | Push first, as asked; iPhone needs the app installed to the home screen, so email is the fallback for anyone who has not installed |
| UI | Tailwind with the design tokens as CSS variables, headless Radix primitives, components built to match the design | The design is custom, so a styled library would fight it; tokens give light and dark mode from day one |
| Data layer | TanStack Query over the Supabase client; React Router | Caching, retries and optimistic updates without a store to maintain |
| Testing | Vitest for logic, pgTAP for RLS policies, Playwright on Chromium and WebKit for flows | WebKit in Playwright is the stand-in for an iPhone until a real-device pass |
| Repo and CI | One GitHub repo (`app/`, `supabase/`), GitHub Actions: lint, typecheck, Vitest, Playwright, pgTAP and type generation on every PR; Supabase migrations on merge to main. Cloudflare Workers Builds deploys the app itself | Solo, AI-assisted build: every change goes through the same gate |
| Offline | Later (Phase 8). v1 caches what you have read; writes need a connection | The queued-ticket flow in the design is real work on its own |
| Archive and delete | Things people pick from (restaurants, people, equipment, contractors, categories, templates) are archived, not deleted; records of what happened (tickets, walkthroughs, updates, service records, invoices) are never archived or deleted; anything can be deleted only while nothing points to it | Keeps every history and every report intact while still letting an admin clear a mistake or a test entry. The full table is under Archive and delete below and in `CLAUDE.md` |
| Permissions | Four roles with defaults from the Roles & rights screen, overridable per person | Managers can be granted equipment edits and cost visibility by an admin; the database checks the grant, not the screen |
| Avatars | Initials follow the boards: the color comes from the role, and pending and expired invites have their own. An admin can turn profile photos off for the whole group | The color says who is talking on a ticket thread and matches the design. The switch is enforced in the database and keeps the files, so it can be reversed |
| Group name and domains | The group's name is a field in the database, never in the code. Each group gets its own subdomain: `fourcorners.ontrack-app.app`, later `hogsalt.ontrack-app.app` | Another restaurant group may want the app someday, and nothing about Four Corners should have to be edited out of the code when that happens |

Google sign-in is planned as OT-59: the group is on Google Workspace with its own domain, and it is deferred until their IT person is involved (see Open items). `fourcorners.ontrack-app.app` is connected, which QR labels need, since they bake the URL in.

## Architecture

![architecture · 5 parts, 1 host](architecture.png)

The phone never holds a secret: it signs in with Supabase Auth, then reads and writes tables and files under row-level security. Edge Functions run with the service key for the few jobs a phone cannot do safely (send an invite, push to other people's devices, process an import, render a label sheet, create next month's walkthroughs on a schedule). Cloudflare Workers Builds deploys the app on every push (production from `main`, a preview per branch), and GitHub Actions deploys the migrations and functions to Supabase on every merge.

The app gets two public build values, the Supabase URL and the publishable key (`sb_publishable_…`). Both end up in the JavaScript every visitor downloads, so no secret key, `service_role` key or personal access token may ever go in a `VITE_` variable. Cloudflare keeps build variables per environment: Production and each branch need them set separately.

## Data model

Twenty-nine tables in five groups, plus twelve views. Tickets are the center; equipment, service records and walkthroughs all hang off them. The nine-table model in the earlier doc grew by the walkthrough, contractor and rights tables the design added.

| Group | Tables | Notes |
| --- | --- | --- |
| Org and access | `restaurants`, `profiles`, `memberships`, `invites`, `rights`, `push_subscriptions`, `audit_log`, `group_settings`, `support_reports`, `two_step_codes`, `two_step_devices`, `two_step_passes`, `two_step_resets` | `restaurants` holds name, address, phone, accent color, manager. `group_settings` is a single row for the group: its name, its short name, and whether profile photos are allowed. `profiles.role` holds the role (manager, ops, leadership, admin); `memberships` is scope only, one row per restaurant or a single null row for all restaurants, which ops and leadership get by default. `rights` = the Roles & rights grid: a default row per role, plus per-person override rows. Right keys: `create_tickets`, `see_all_tickets`, `update_status`, `log_cost`, `see_costs`, `edit_equipment`, `see_contractors`, `set_walkthrough_schedule`, `invite_users`, `manage_rights` |
| Equipment | `equipment`, `categories` | Category carries area (FOH or BOH). Equipment has brand, model, serial, installed, warranty, location note, manual file, retired_at |
| Tickets | `tickets`, `ticket_updates`, `ticket_photos` | Ticket: restaurant, equipment (optional, at that restaurant and not retired when linked), category, title, description, urgency (low, normal, urgent), status, assignee, source (reported or walkthrough), walkthrough_id, reopened_at. Status is an enum: open, in_progress, waiting_parts, scheduled, reopened, closed. Updates carry text, photo, internal flag, and system events (assigned, status change, closed, reopened) |
| Service and money | `contractors`, `service_records`, `service_line_items`, `invoices` | A service record belongs to a restaurant, optionally a ticket (whose restaurant and unit it then takes, since OT-90) and a unit, and optionally a contractor; line items are labor, parts, trip. An invoice is a file plus number, amount and status (attached, missing). Per-unit and per-contractor spend are views over service records |
| Walkthroughs | `walkthrough_schedules`, `walkthrough_templates`, `walkthrough_items`, `walkthroughs`, `walkthrough_checks`, `inhouse_fixes`, `quarterly_tasks` | A schedule is group-wide or per restaurant (rotation of months). A walkthrough is one restaurant for one month; checks are its item results (good, in-house, ticket). In-house fixes link back to the check and can convert to a ticket. Quarterly tasks are group-wide with per-restaurant overrides and removals |

**How rights work.** The JWT carries the user id, plus the level and session id Supabase Auth adds for 2-step verification, and no rights. A SQL function `can(action, restaurant_id)` reads `profiles.role`, `memberships` and `rights` and is used by every policy, so a manager with `edit_equipment` granted by an admin passes the same check an ops manager does. Leadership policies are select-only. The service role used by Edge Functions bypasses RLS, which is why those functions check the caller themselves before acting.

**Counting and costs** (open tickets per restaurant, spend this year per unit, visits per contractor) are Postgres views, not client-side sums, so every screen shows the same numbers.

All five groups landed in Phase 0 (OT-2, eight migration files; Phase 1 added its own access tables to the first group) even though phases 1 to 4 use only the first three; adding walkthrough tables later would have meant reworking the ticket table's `source` and `walkthrough_id` columns. Account creation is invite only in the database itself: a trigger on new auth users takes role and restaurants from a pending invite and rejects anyone without one.

## Archive and delete

Decided Oct 30, 2026, after restaurants got archive and delete in OT-9. Each phase builds these for its own entities the same way: a database function per action that checks the caller and logs it, the "only while nothing points to it" rule enforced in the database, and a confirm sheet on the row.

| Entity | Archive (reversible) | Delete | Phase |
| --- | --- | --- | --- |
| Restaurants | Archive / Restore | Only with no history and nobody's home restaurant | 1 (OT-9, done) |
| People | Deactivate / Reactivate: no sign-in, out of pickers, name kept on history | Revoke a pending invite; delete an account only with no history | 1 (OT-10 revoke and ban, OT-12 User profile) |
| Equipment | Retire | Only with no tickets or service records | 4 |
| Contractors | Archive | Only with no service records | 5 |
| Categories, walkthrough templates and items, quarterly tasks | Turn off | Only if never used | 6; categories later, not scheduled |
| Tickets | None (closing ends a ticket) | Never | |
| Walkthroughs, ticket updates, service records, invoices | None (they are the record) | Never; edits are logged | |
| In-house fixes and tasks | None | While still open | 2 (OT-30) |

## Phase 0 · Foundation

An empty app that installs on a phone, switches between light and dark, deploys on every merge, and has a database whose permissions are already tested. Nothing a user would call a feature, but every later phase moves faster for it.

**Status:** done in OT-1 to OT-3; the real-iPhone check waits for a real iPhone (see Status above).

**Ships**

- Repo with `app/` (Vite + React + TypeScript) and `supabase/` (migrations, functions, seed, tests); GitHub Actions running typecheck, Vitest, pgTAP and Playwright on Chromium and WebKit
- Cloudflare Workers Builds connected to the repo: production on `main`, a preview URL per branch
- Supabase project with the full schema from the data model, RLS on every table, the `can()` function, and pgTAP tests that sign in as each role and assert what it can and cannot read
- Seed script with the four restaurants, their colors, sample users for each role, equipment and tickets matching the design's sample data, so every demo starts from the same state
- Design tokens as CSS variables (colors, spacing, type, radii) with a dark set; Tailwind wired to them; the `prefers-color-scheme` default plus a manual toggle saved per device
- Component kit built from the design: button, pill, card, list row, bottom tab bar, sheet, field, select, switch, segmented control, avatar, toast, skeleton. Each one has a Storybook-style page in the app under `/kit` for checking both themes
- PWA shell: manifest, icons, splash, service worker with precaching, install prompt, `100dvh` and safe-area padding, 16 px minimum input size
- App frame: routing, auth guard, the four role shells with their tab bars, loading and error boundaries

**Screens from the design:** Loading states (spinner, list and detail skeletons), Error 404, 500, no access

**Done when:** a teammate can open the preview URL on an iPhone, add it to the home screen, toggle dark mode, and the RLS tests pass for all four roles.

## Phase 1 · Accounts and access

Real people can be invited, sign in, and land in the right role, with rights an admin can adjust. Everything after this is gated on who is looking, so it comes first.

**Ships**

- Admin: Restaurants list and Add restaurant (name, address, phone, manager, accent color with the preset swatches and custom picker, taken-color check)
- Admin: Users list with filters (all, pending, managers, ops), Invite user (name, email, role, restaurants), resend and revoke, user profile with per-person rights override, View as (a read-only view, not impersonation: no token changes hands, and it is logged to the audit table)
- Admin: Roles & rights grid, editable defaults with the confirm sheet, locked admin column
- Invite email through Resend; invite link single-use, 72-hour expiry; Set up account screen (name, password rules, confirm)
- Sign in, password reset (request, sent, email, new password, done), expired link and signed-out screens. The Sign in button stays disabled until the email has a valid shape and the password has at least 12 characters (the provisional screen from Phase 0 only disables it when Supabase is not configured)
- 2-step verification (OT-13): TOTP with authenticator app (choose, scan, verify, backup codes) required for admins and offered to everyone, enforced in the database; once on, it stays on for that person. Backup codes and "Don't ask again on this phone for 30 days" are ours, since Supabase Auth has neither. An admin can reset it for someone, with an email to them; the only admin's recovery is a line of SQL (see CLAUDE.md). The SMS option waits unless the group asks for it, since it adds a Twilio cost
- Profile (name, phone, restaurant, theme toggle, sign out) and Help & support (report a problem to a support inbox, FAQ)
- Group name as data (OT-10, first step): `group_settings` holds the name and short name, and every "4C | Four Corners" reads from it, including the admin header and the invite email. The name and short name can be read before sign-in, because Checking your invite shows them. The migration starts the row as "OnTrack", the seed sets Four Corners, and the hosted project gets its name by one SQL update after merge. Links in emails come from an `APP_URL` function secret, never from a domain in the code. The app description in `index.html` and the manifest drops the group's name
- Group settings on Roles & rights (OT-14): an admin edits the name and short name there, through a database function that writes `audit_log`
- Profile photo switch (OT-14): an admin turns profile photos off or on for the whole group. Off refuses new uploads in the storage policies and on `profiles.avatar_path`, stops serving existing photos, and shows initials everywhere; Profile drops Upload and Change. Files are kept, so turning it back on restores them, and a person can still remove their own photo while it is off: Profile keeps Remove for anyone with a saved photo and tells them it is hidden and comes back if photos are turned on again. Whether photos are on or not, uploading and removing confirm with a message, since neither waits for Save changes. A photo link already handed out works until it expires, within the hour, and other people's screens follow within five minutes or on reload. It follows the OT-9 pattern: an admin-only database function that writes `audit_log`, a confirm sheet, and pgTAP for the role check, the refusal and the log. Ticket and equipment photos are not affected. No board exists for this, so it is a `Switch` row with the kit's confirm sheet on Roles & rights, under Edit defaults
- Edge Functions: `invite-user`, `revoke-user`, `reset-two-step`, `send-email`. They run with the service key, so each checks the caller with `can()` or `is_admin()` first. `revoke-user` sets `profiles.deactivated_at` and also bans the auth user so refresh tokens stop working
- A `/security-review` pass before the invite and sign-in work merges, since this is the first code that holds the service key

**Screens from the design:** Admin · Users, Invite user, Roles & rights, User profile, View as, Restaurants, Add restaurant; Invite email, Set up account, Sign in, Password reset 1 to 5, 2-step setup 1 to 4 and the sign-in code screen, Profile, Help & support, Error · link expired, no access, signed out

**Done when:** an admin invites a manager from a phone, the manager sets up the account from the email on another device (a tablet or a phone on wifi is fine, since nothing here needs a phone number), and the RLS tests show the manager sees only their restaurant. Granting `see_costs` to that manager in Roles & rights changes what the database returns, with no app change.

## Phase 2 · Tickets, the manager loop

A restaurant manager can report a problem from a phone in under a minute and follow it to closed. This is the first thing worth showing the Four Corners team, even before Ops has its own screens.

**Ships**

- Open tickets list: Tickets and In-house tabs with counts, search, All / Front / Back segments, the restaurant label with its color square, cards with status pills and icons
- Create ticket in two steps: area and category grid (counts per category), then the form (title, description, photos, urgency, optional equipment picker filtered to that restaurant)
- Ticket detail: header with status and urgency, description, equipment card, the update thread with photos, the composer with camera, system events in the timeline
- Edit or close ticket (manager side), with the closed state read-only
- Closed ticket: resolution, contractor and cost shown only when `see_costs` is granted, 30-day reopen window, the Reopen ticket sheet that sets status to Reopened and notifies Ops
- Photo upload: resized to 1600 px in the browser, stored under the ticket, thumbnails in the thread
- Empty and no-results states for the lists; the save-failed validation state on the form
- Status icons, pills and the restaurant color square as shared components, since every later list reuses them

**Screens from the design:** Manager · Open tickets, Open in-house tasks, Create ticket area, Create ticket form, Open ticket, Edit / close ticket, Closed ticket; Empty · Manager open tickets; No results · ticket search; Error · validation on save

**Done when:** a manager at Federale’s Logan Square creates a ticket with a photo on an iPhone, it appears in the database with the right restaurant, and a second manager at Porter cannot see it. Ops can still only see tickets through the database at this point; that is Phase 3.

**Pull requests**

| PR | Scope |
| --- | --- |
| OT-25 | Default categories on the hosted project; Open tickets list with search and Front / Back segments; empty and no-results states; the ticket card |
| OT-26 | Create ticket: area and category, then the form with the equipment picker; the save-failed state |
| OT-27 | Ticket detail: header, description, equipment card, thread with system events, text composer |
| OT-28 | Photos: resize to 1600 px, add on the form and in the composer, thumbnails in the thread |
| OT-29 | Edit and close, Closed ticket, the Reopen sheet, cost shown only with `see_costs` |
| OT-30 | In-house tab: list, check off, delete while open |
| OT-33 | From OT-29's open questions: an ellipsis menu beside the search on Open tickets with View Closed Tickets, opening a simple list; Title on Edit ticket |
| OT-34 | From trying Phase 2 live: no scrollbar on the message field at one line |
| OT-35 | Faster CI: docs-only PRs run nothing, the flows run one job per browser, and a `quick` label skips them on a small fix's PR |
| OT-31 | The done test as one flow; the phase note |
| OT-32 | From trying OT-26 live: Open tickets loads in the empty layout when it found nothing last time, so it doesn't jump |

**What this phase has to work around**

- **Categories exist only in `seed.sql`, so the hosted project has none, and a ticket requires one.** OT-25 adds the design's list in a migration, and the seed stops inserting its own. Nothing can be created on the live app until that merges.
- **Open tickets cards always say who is on the ticket.** The board shows a contractor on one card, but managers cannot read service records without `see_costs`, and none exist until Phase 5.
- **The equipment card on a ticket isn't a link until Phase 4,** when the unit has a page to open.
- **A ticket's thread rereads every 30 seconds** while it is on screen and when the app comes back to the front, so a reply turns up without a reload. Live updates can wait for push in Phase 3, if the delay matters.
- **A closed ticket takes no message or photo from a manager,** in the database as well as on screen. Ops keeps the right, for what Phase 3 builds.
- **Edit ticket adds Title to its board** (decided Nov 1, 2026, built in OT-33), alongside description, equipment, a photo and urgency. The closing comment is optional, as the board has it. Urgency adds Low, which Create offers.
- **Reaching a closed ticket:** the board's only way is Equipment Tickets in Phase 4, and a ticket with no equipment would have none. Closing offers View closed ticket, and OT-33 adds an ellipsis menu to the right of the search on Open tickets, with View Closed Tickets opening a simple list (decided Nov 1, 2026). With nothing open there is no search, so the menu sits beside the title. It has room for more items later. Neither the menu nor the list has a board. The list shows the latest 100.
- **The boards' notification promises wait for Phase 3:** "You'll get a notification when work starts" and "Ops has been notified" are left off, since nothing notifies yet. OT-46 puts them back.
- **Photos go up after the ticket they belong to,** whose folder and policies they need. If they fail, the ticket stands and the message says to add them in an update. In an update the files go first, so a failure posts nothing. A file uploaded just before a failed post stays in Storage unreferenced, which only people who can see the ticket can reach.
- **Tapping a photo opens it large, and picked photos show in a tray with Remove.** Neither has a board. An update or new ticket takes up to 6 photos.
- **Nothing adds equipment until Phase 4.** On the live app the picker is empty and every category says 0 items, so tickets there have no equipment. The seeded stack shows the full boards.
- **The done test's second manager is seeded.** The boards have nobody at Porter but an expired invite, so the seed adds Dana Ortiz as its manager. That person shows on Users, which the board doesn't draw. On the live app, the same test needs a real invite to a manager at Porter.
- **Nothing adds in-house tasks until Phase 6** (until OT-83, Nov 6, 2026, which lets a manager add one by hand). Walkthroughs create them, so the In-house tab stays empty on the live app, and OT-30 is proven on seeded data. That empty list says "Nothing to fix right now", which has no board.
- **A checked-off in-house task offers no Delete,** though the board draws it, since the rule is delete while open and the database refuses it. Unchecking brings the task back, and it can be deleted then.
- **Deleting an in-house task removes the row,** as the board's "permanent" says, and the audit log keeps who deleted what. Each task now carries its area, because Front and Back can't be read from a quarterly task's label; a task with none shows only under All. Phase 6 sets the area when it creates a task, and adds the write that Convert to ticket needs.
- **The QR buttons wait for Phase 4,** since a scan would have nothing to open: Scan an equipment QR code on Create ticket, and Scan a QR code with its sentence on the empty Open tickets screen. These are the planned differences from those boards.
- **Save-failed uses Log service's board.** The only Error-Save-Failed board is drawn on Log service, so Create ticket takes its banner and its Report a problem link. It says what went wrong and keeps everything typed.
- **A manager with more than one restaurant** has no board: they get a Restaurant picker on Create ticket, and the restaurant's name on each Open tickets card.
- **Reopening writes the thread event but notifies nobody yet.** Push and email arrive in Phase 3, which keeps the "notifies Ops" promise.
- **Categories can't be turned off or deleted yet.** That is saved for later (Oct 31, 2026), so the list from OT-25 stays as it is until then, and changing it means a migration.
- **View as:** each screen scopes its data from `useUser()` and hides writes when `viewingAs` is set, and Open tickets replaces the manager's placeholder in `ViewAsScreen`.

## Phase 3 · Ops dashboard and ticket work

The ops managers can run their day in the app: see every restaurant's open work, pick up tickets, talk to the restaurant, close, and handle a reopen. With push, this is the point where the app replaces texting.

**Ships**

- Ops dashboard: tickets under a label for each restaurant, in an order each person can change, an ellipsis menu leading to closed tickets, cards with restaurant color squares, walkthrough tags and a badge naming who is working on the ticket; the restaurant picker (All restaurants plus each one) that scopes every Ops screen
- Ops ticket detail: the status dropdown, description, equipment card, updates thread with the internal-note toggle ("Visible to restaurant"), composer
- Closed tickets grouped by month with totals; closed ticket detail
- A reopened ticket is an ordinary ticket with a Reopened badge
- Push notifications: subscribe on install, store per device, Edge Function `send-push` fired by database triggers for new ticket, status change, new update visible to the restaurant, reopen. Email as well as push, on by default, with its own switch. A Notifications section on Profile to turn each kind on or off
- One lasting link per ticket, `/t/OT-1042` (OT-62; it was `/t/<id>` until then, and those links still open), which opens the right screen for whoever taps it, since `/tickets/:id` is for managers only. A signed-out person goes through sign-in and back, and the link grants nothing: someone who can't see the ticket gets the same refusal as today. Push and email notifications use it, built from the group's own address. The number is forgiving to type (`ot-1042`, `OT-01042` and `1042` open the same ticket) and is turned into the ticket under RLS, so it grants no more than the id did
- Share link on a ticket, in the ellipsis menu from OT-33: the phone's share sheet (Messages, Copy and so on), or on a computer it copies the link and confirms. No board draws it
- Empty states for the dashboard and Closed tab; loading skeleton for the card feed

**Screens from the design:** Ops · Dashboard, Ticket detail, Closed tab, Reopened ticket; Empty · Ops dashboard, Ops closed tab; Loading · card feed skeleton; Error · something went wrong

**Done when:** a manager creates a ticket and the ops manager's phone buzzes; the ops manager marks it In progress, posts an update the manager sees, closes it with a comment; the manager reopens it and Ops sees Reopened on the dashboard. Playwright runs that whole loop on WebKit.

**Pull requests**

| PR | Scope |
| --- | --- |
| OT-36 | Plan update and this split |
| OT-37 | Ops dashboard: Open tab, All / Mine, the restaurant picker that scopes every Ops screen, cards, empty state, loading skeleton; replaces the ops placeholder in View as |
| OT-38 | Saved for later: the dashboard's filter sheet, unless Ops asks for it |
| OT-39 | Ops ticket detail: header, description, photos, equipment card, the status dropdown, marking In progress puts you on it, Take this over, a date for Scheduled |
| OT-40 | Ops thread: composer with photos, the internal-note toggle, Close ticket with a comment |
| OT-41 | Closed tickets, opened from the dashboard's menu: grouped by month with totals, its empty state, closed ticket detail |
| OT-42 | Dropped from feedback (Nov 2, 2026): a reopened ticket has no screen or sheets of its own; see OT-52 |
| OT-43 | Lasting link `/t/<id>` for every role, and Share link on a ticket |
| OT-44 | Push on a device: service worker handles push, subscribe per device, the Notifications section on Profile, a test push to your own phone |
| OT-45 | `send-push`: an outbox written by a database trigger for each kind, who gets what, email on by default as well as push, links through `/t/<id>` |
| OT-46 | Put back the boards' notification promises; check on a real iPhone how it opens a link; a temporary ring on a new ticket's card, for Ops and managers; the small notification icon on Android; a clearer name for the device switch, which comes back on after signing back in; from feedback, Update says it is updating, and Create ticket opens on Front of House |
| OT-48 | Simplify the dashboard from feedback: no assigning, no Unassigned, no All / Mine; a badge names who is working on a ticket |
| OT-49 | Tickets grouped under a label for each restaurant; Closed moves to an ellipsis menu; a reopened ticket is an ordinary card with its pill |
| OT-50 | Change the order of the restaurants on the dashboard by dragging |
| OT-51 | From feedback: a reopened ticket is on the dashboard and not in Closed tickets; the Ops message box hidden until Add update; no "Nobody has this yet" note |
| OT-52 | From feedback: a reopened ticket acts like a new one apart from its badge, with nobody on it and no date |
| OT-55 | Security audit of what Phase 3 added: policies and functions since OT-22, internal notes and their photos, Ops and manager scope, links, push and `send-push` |
| OT-56 | Code quality pass: the repeated ticket header, the similar closed-ticket screens, `v_closed_by_month` that nothing uses, leftovers from simplifying |
| OT-57 | From feedback: Edit, Close and Share in the menu on a manager's ticket, with Close still on Edit ticket |
| OT-58 | From trying OT-45 live: a failed call to `send-push` says why in `notify_problems`, and lists change as tickets do, through Realtime |
| OT-59 | Deferred (Nov 4, 2026) until the group's IT person is involved: Google sign-in, tried on an installed iPhone app first, then Google alongside invites, with no password for people on the company domain |
| OT-61 | From feedback (Nov 4, 2026): Show / Hide on every password field, as the setup and reset boards draw it |
| OT-62 | From feedback (Nov 4, 2026): ticket links by number, `/t/OT-1042`, forgiving to type; older links with the id still open |
| OT-63 | From feedback (Nov 4, 2026): a shorter header on a manager's Open tickets and In-house: no search and no Front / Back, and the ellipsis menu beside the title |
| OT-64 | Faster CI: the flows run in Playwright's own Docker image, since installing WebKit's system packages from Ubuntu's mirror took 12 to 22 minutes |
| OT-47 | The done test as one flow; the phase note |

**What's left (Nov 5, 2026)**

Done: everything above but OT-38 (saved for later) and OT-59 (deferred), through OT-56's code quality pass and OT-47's done test (Nov 4, 2026; see the Phase 3 note). The buzz from a new ticket and the notification badge were tried by hand on Android (Nov 5, 2026).

Left: OT-46's iPhone link check, deferred with QR labels (Nov 5, 2026; see the open item), and iPhone push, which waits for a real iPhone.

**What this phase has to work around**

- **Nobody assigns a ticket (from feedback, Nov 1, 2026; OT-48).** A ticket is Open until an Ops manager marks it In progress, which puts them on it. Every Ops manager sees every ticket, with a badge naming anyone else on it; your own tickets have no badge. This replaces what the boards draw: the Unassigned pill, the assignee dropdown, All / Mine and the initials in the card's corner. `assignee_id` stays as who is working on it, so the thread and history still say who. `set_ticket_status` applies this in one step: In progress puts you on the ticket, taking it from anyone who had it, back to Open takes the person off, and Waiting on parts or Scheduled keeps whoever has it, or you if nobody does. Take this over, in the status menu, is for a ticket a colleague has. Nobody is asked first. Scheduled asks for its date in a sheet with no board.
- **The dashboard is grouped by restaurant (from feedback, Nov 1, 2026; OT-49),** since an Ops manager travels between restaurants through the day. Each restaurant has a label with its count, and a restaurant with nothing open is left out. This replaces the boards' single list, their Open and Closed tabs and the badge on Closed, and the restaurant's name on each card. Closed tickets move to an ellipsis menu by the title. A reopened ticket is an ordinary card with its pill, so the boards' tinted card and quoted reason are gone; the reason is on the ticket.
- **One fixed order under each restaurant (Nov 1, 2026; OT-49):** urgent always on top, then Front of House before Back, then the oldest first. The time on a card is how long ago it was opened, so the order can be read. A manager's Open tickets keeps its own order, the latest activity first.
- **The restaurant order changes by dragging (OT-50),** in a sheet from the same menu, not on the dashboard itself, where dragging would fight with scrolling on a phone. It is saved per person on the device, like the picker's choice, so it doesn't follow someone to another device, and the picker lists restaurants in the same order. It uses `@dnd-kit` for touch and keyboard, loaded only when the sheet opens. The dashboard rereads every 30 seconds, so a new ticket turns up on its own before push arrives. The picker's choice is remembered per person on the device.
- **The message box is hidden until asked for (from feedback, Nov 2, 2026; OT-51).** Ops says writing back and forth will be rare and it took a lot of the screen, so Add update beside the Updates heading opens it. Posting closes it, and hiding it keeps the draft. A manager's ticket keeps its box open. The "Nobody has this yet" note on an open ticket is gone too.
- **Internal notes (OT-40):** the toggle stays where it was set after posting, since a note going out by accident is the worse mistake. Close ticket takes an optional comment, as a manager's does. After closing, Ops goes back to the dashboard.
- **Closed tickets (OT-41):** a screen of its own with a back arrow, since Closed is no longer a tab. It opens on this month, four tickets to a month until Show more, and See <month> adds the month before, which the empty board draws and the full board had no way to reach. Months follow the person's own time zone (`closed_by_month`), so a ticket closed on the evening of Oct 31 in Chicago is under October. A reopened ticket is not on it (from feedback, Nov 2, 2026; OT-51): it is open work, so it is only on the dashboard, and comes back here in the month it closes again. A ticket with no service record shows no amount. Without `see_costs`, no totals or amounts show at all. The board's lines saying closed tickets also appear on each unit wait for Phase 4, so Phase 4 puts them back.
- **A closed ticket on Ops (OT-41)** follows the board's closed state, plus the description and photos, since the board relies on a reopen flag to say what was wrong. Like a manager's Closed ticket it has a timeline and no chat, so messages and internal notes can't be read once it closes. If Ops misses them, add the thread below the timeline.
- **Reopening stays simple (from feedback, Nov 2, 2026; OT-52).** Managers can reopen, but will more likely just make a new ticket, so a reopened ticket acts like a new one apart from its badge: on the dashboard, nobody on it, no date, on the ordinary Ops ticket screen with the reason in the thread. This replaces the Ops-Closed-Ticket board: no flag panel, no Start work or Close again sheets, and no Start work anyway, so Ops can't bring back a closed ticket. It keeps its old number and opened date, so under its restaurant it sorts by when it was first opened.
- **A new ticket has a ring for a few minutes (from feedback, Nov 2, 2026; OT-46).** No board draws it. A ticket's card has a ring for 5 minutes after it was created, on the Ops dashboard and on a manager's Open tickets, worked out from `created_at`, so everyone who can see the ticket sees it on any device, it survives a reload, with no state to store. A timer on each card takes it off on time, since a manager's Open tickets doesn't reread on its own. It stays for the full time even if someone opens the ticket. A reopened ticket gets no ring, since the request was for new tickets.
- **The filter sheet is saved for later (Nov 1, 2026).** With grouping and a fixed order, Ops may rarely need it, so it isn't built unless they ask. If it comes back: Status with Reopened added, Walkthrough only, Area and Category, with no Sort or Urgent only, results staying under their restaurants, and nothing remembered between visits.
- **Links to later phases stay off for now.** Log service waits for Phase 5, so the ticket has no service and cost section until then, rather than an empty one that seeded tickets with costs would contradict. The equipment card opens nothing until Phase 4, and From October walkthrough opens nothing until Phase 6. The Equipment, Walkthroughs and Contractors tabs stay placeholders.
- **Costs are mostly empty until Phase 5.** The Closed tab's month totals and a closed ticket's cost come from service records, which nothing on the live app creates yet, and they need `see_costs`. The seeded stack shows the full boards.
- **Push on a device (OT-44).** The worker `vite-plugin-pwa` generates stays as it is and imports `public/push-sw.js`, so the update prompt is untouched. A device's row follows whoever signed in last, signing out removes it, and deactivating someone removes all of theirs. The app re-saves the row each time it opens, since a browser can change its subscription. Notification switches are per person, on unless turned off, and Profile shows the kinds that role is sent. Those switches and the email fallback have no effect until OT-45.
- **Encrypting Web Push on Edge Functions uses `@negrel/webpush` (JSR),** since `web-push` relies on Node crypto calls. OT-44's `test-push` proves it with a real phone before any trigger depends on it. It posts to the stored endpoint with no further check, so `push_subscriptions` only accepts the browsers' own push services; a new one needs adding to that constraint.
- **Email is on by default, not a fallback (from feedback, Nov 2, 2026; OT-45).** The ops manager has Claude summarize his work from his inbox, so email goes out as well as push, and Ops managers also get email about their own actions, including their internal notes. They also get email when another Ops manager picks up a ticket (marks it In progress or takes it over) or closes it at a restaurant they cover, also from feedback. Other status changes and updates on other Ops managers' tickets stay out, for now. Someone who only wants email leaves This device off. A better way to make weekly summaries may replace this later. A kind's switch covers both push and email, and there is no email-only setting per kind.
- **Taking a ticket over with no status change reaches only Ops, by email (OT-45),** so the manager who opened it isn't told, since the work is the same.
- **A status change goes to the manager who opened the ticket, not every manager at the restaurant (confirmed Nov 2, 2026).**
- **Lists change as tickets do (from trying OT-45 live; OT-58).** Realtime sends a signal when a ticket changes, RLS decides who gets it, and each screen rereads its usual query. A manager's Open tickets also rereads every 30 seconds now, as the dashboard does, in case the connection drops. Realtime replaces nothing else, and the stack and CI now run with it on.
- **The device switch (from feedback, Nov 2, 2026; OT-46).** "This device" reads as unclear, so it becomes "Push notifications on this device", which still reads right when it is on. Signing out turns it off on purpose, so a shared phone stops getting the last person's tickets, but having to turn it back on is easy to miss. So a phone remembers, per person, that they had it on, and turns it back on when they sign back in. Turning it off yourself stays off, and someone else signing in starts with it off. If the app can't read the subscription, it says so rather than showing Off.
- **Google sign-in (from feedback, Nov 2, 2026; OT-59),** moved up from Phase 8, since the group has no accounts yet and nobody would have to move over later. The ops manager expects deactivating to happen at Google, but that only stops new sign-ins: a session already open lasts up to 12 hours, since the cap is on the app's side, a password set in OnTrack still works, and push keeps arriving with ticket details. So people on the company domain sign in only with Google and have no password, and Deactivate in OnTrack stays, as the one switch that works at once and stops notifications. A scheduled check of Google's directory that deactivates suspended people could come later, with help from whoever runs their Google admin. Invites stay, since Google says who someone is and the invite says their role and restaurants. That changes `handle_new_user`'s rule that an email alone never claims an invite, so it needs care, and a Google-verified address on the company domain is the only new thing it may trust. 2-step stays required for admins and optional for others, and a remembered phone needs changing, since it now asks for a password sign-in. Google sign-in from an installed iPhone app can finish in Safari rather than the app, so OT-59 tries that first, before building the rest. It was planned before the security audit so the audit would cover it; the audit (OT-55) went first while the open questions wait, so OT-59 gets its own security check, like OT-45's. **Deferred (Nov 4, 2026)** until after more of the major features: the group is on Google Workspace on its own domain and everyone has a work account, but their IT person isn't involved yet and should be before anything is set up on their Google admin, and nobody has asked the managers who is on an iPhone. Deferring costs little. Accounts made before it arrive with passwords, so OT-59 then also moves them over: someone on the company domain signs in with Google once, it joins their existing account by the verified address, and their password is removed. It is best done before accounts go out widely, which Phase 4's demo starts, but nothing waits on it.
- **The notification promises (OT-46)** come back where they are now true. The reopen banner says "You'll get a notification when work starts", since a status change reaches whoever opened the ticket. Edit ticket's close says "Ops has been notified" only when someone is on the ticket, since a manager's close reaches only them, and otherwise keeps "Ops will see it as closed". On Ops, the opened line in the thread says "all Ops managers notified" when a manager opened it, as the board does; a manager's thread doesn't say it, as their board doesn't. Help already said Ops is notified right away. Roles & rights and User profile stay off, since rights changes notify nobody.
- **Update says it is updating (from feedback, Nov 4, 2026; OT-46).** Tapping Update waits for the new version to take over, which can take a few seconds and looked like nothing happening. So the bar says "Updating, one moment please…" with a spinner, and a light scrim over the page takes taps, since anything started then is lost in the reload. If the new version never reports back, the page reloads itself after 10 seconds. No board draws the bar; it moved onto the primary button's green, since the darker green it had turned pale in dark mode.
- **A manager's tickets have a shorter header (from feedback, Nov 4, 2026; OT-63).** The boards stack the restaurant, the title, the Tickets / In-house tabs, a search field and Front / Back above the first card. A manager has few tickets, fewer than Ops, so Open tickets and In-house drop the search and Front / Back, and the list starts under the tabs, in the same order as before. The ellipsis menu that leads to closed tickets moves beside the title, where it already sat with nothing open and where the Ops dashboard keeps its own. This replaces the Empty-Search-Tickets board and the empty state for an area with nothing open. Each card still names its area. Equipment in Phase 4 is a separate list and decides its own search then.
- **Create ticket opens on Front of House (from feedback, Nov 4, 2026; OT-46),** where the board opens on Back. Coming back from the form still keeps the area that was picked.
- **The small notification icon (OT-46).** Android shows a generic bell in the status bar until a push names a `badge`, a white shape on transparent, so it gets the mark's check. The picture beside the message is the app icon already. An iPhone always shows the app's own icon, and none of this can change that.
- **Who gets notified (a default, Nov 1, 2026, until someone asks otherwise):** a new ticket goes to every Ops manager who covers that restaurant, as the board's "all Ops managers notified" says. A status change or an update the restaurant can see goes to the person who opened the ticket and the person working on it, and never to whoever did it, so a manager hears when work starts. A reopen goes to all those Ops managers, as a new ticket does. An internal note never reaches a manager, and notifies nobody at this stage.
- **Setup outside the repo:** VAPID keys are new, from `node scripts/vapid.mjs`. `VAPID_KEYS` goes in the hosted project's function secrets and `VITE_VAPID_PUBLIC_KEY` in the Worker's build variables, per environment. The database calls `send-push` through `pg_net`, which needs `send_push_url` and `send_push_secret` in its vault and the same secret as the `SEND_PUSH_SECRET` function secret; OT-45 lists the steps.
- **Playwright can't feel a phone buzz.** The done flow checks that the right people were sent the right notification, and the buzz itself is tried by hand on a real phone. That proves it on Android. iPhone push needs the app installed on a real iPhone, so it waits until it is tried on one by hand.
- **A manager's ticket header has only its menu (from feedback, Nov 2, 2026; OT-57):** Edit ticket, Close ticket and Share link replace the board's Edit link, which left the header crowded. Close ticket stays on Edit ticket too. Closing from the menu stays on the ticket, which becomes its Closed ticket screen.
- **Share link (OT-43)** is on every ticket screen, in a menu on its header, including closed tickets. A phone gets its share sheet and a computer copies the link and confirms; the choice follows whether the device has a coarse pointer, since desktop browsers also offer a share sheet. The message carries the ticket number and title, so whoever shares it decides who reads those.
- **`send-push` gets its own security check in OT-45,** since it runs with the service key, then the audit (OT-55) and code quality pass (OT-56) come before the done test, so the done test covers their fixes.
- **`/t/OT-1042` has no screen to open for admin and leadership until Phase 7,** when their ticket views arrive. Until then they get the no-access screen, whatever the database would let them read.
- **Roles & rights' "everyone affected is notified" stays off.** Changes to rights aren't among this phase's notifications, so that open item carries on.
- **View as:** each Ops screen scopes its data from `useUser()` and hides writes when `viewingAs` is set.
- **Security audit (OT-55, Nov 4, 2026).** An audit of everything merged after OT-22 (the migrations from `20261031120000` on, `send-push`, `test-push` and the shared push code), tested against the API directly as the seeded people, found 13 items, none critical or high. Fixed in OT-55: writing in a thread needed only to see the ticket, so an admin, a manager with `see_all_tickets` and an Ops manager narrowed to one restaurant could post messages, internal notes and photos outside their scope, and anyone could upload a file under a closed ticket (one rule now, `can_post_on_ticket()`, for messages, photo rows and uploads); a manager could rewrite a ticket's `reopen_count`, `reopened_at`, `last_closed_at` and `closed_by`, Ops could backdate `closed_at`, and a ticket could link to another restaurant's ticket or walkthrough (the guard keeps that record itself, and links stay at the restaurant); a reopen needed no reason, since a bare status change out of closed skipped `reopen_ticket`, for Ops too (leaving closed now needs `reopen_ticket`'s mark); a message's `created_at` and `meta` were the client's (the database sets both); the push endpoint guard had no end anchor, so a URL with a newline after the host passed (anchored, no whitespace); and the return path after sign-in was not checked (`safeReturnPath`; it was unreachable, since the 404 route sits outside `RequireAuth`, and is now checked anyway). Accepted: `see_all_tickets` reads every restaurant whatever the memberships say, which is what the Roles grid promises, so narrowing an Ops manager also means switching their override to Own (written into CLAUDE.md); `pg_net` grants `net.http_post` to signed-in roles and a migration cannot revoke the extension owner's grant, while `net` is not an exposed schema; `ticket_restaurant()` and its siblings map any id to its restaurant for any signed-in person, which the cost policies need (pre-existing, OT-7); a guessed photo path is confirmed by the unique constraint; `notify_problems` may carry the vault's URL in a pg_net error, for admins only; and `/t/<not a uuid>` shows the 500 board rather than 404, left for OT-56. Confirmed sound: internal notes and their photos stay hidden from managers, admins and leadership in every table, in Storage listing and through `can_see_ticket_photo()`; nobody can flip `internal`, edit or delete an update; leadership writes nothing; deactivated people and a session owing its second step get nothing from every new table and function; `send-push` and `test-push` refuse what they should; `notification_recipients` matches the rules here; the vault is readable by `service_role` and `postgres` only; Realtime delivers a ticket's change only to people who can read the ticket, and only `tickets` is published; every new function sets `search_path` and is closed to `anon`; the CSP gained no origins; nothing secret sits in a `VITE_` variable. Each fix has a pgTAP test that failed before it (`33_phase3_audit.test.sql`), and the return path has `e2e/return-path.spec.ts`.
- **Code quality pass (OT-56, Nov 4, 2026).** The four ticket screens, a manager's and Ops's, open and closed, share one top bar, photo strip and equipment card (`screens/tickets/TicketParts.tsx`), and the two closed ones share the closing comment and the timeline (`ClosedParts.tsx`), each drawn as before. `v_closed_by_month` is dropped, since Closed tickets reads `closed_by_month()`, which cuts months in the person's own time zone. The Edit icon left from OT-57 is gone. The audit's `/t/<not a ticket>` turned out to show 404 already, since both ticket queries treat a malformed id as no ticket, and `ticket-link.spec.ts` checks it.

## Phase 4 · Equipment and QR labels · first demo

Every unit has a page, a QR label, and a history (QR labels deferred, Nov 5, 2026; see OT-74). This closes the loop that EcoTrak does not have, and it is the milestone to put on the ops team's phones: phases 1 to 4 together are a complete ticketing app with equipment.

**Ships**

- Ops equipment list: search, filter sheet (restaurant, area, category), category disclosures with open-ticket badges, rows with restaurant color, brand, serial and this year's spend
- Manager equipment list: their restaurant's units, browsed by Front / Back and then category, with no search (OT-68), and Add equipment only when `edit_equipment` is granted
- Equipment detail tabs: Details (serial, QR from OT-74, brand, model, category, location, installed, warranty, manual), Tickets (open on top, closed in a disclosure), Service & cost (lifetime and 2026 cost, visits, contractors on this unit, service log). Cost tabs hidden without `see_costs`
- Add and Edit equipment, Retire equipment; the saved screen with the QR label and Print waits for OT-74
- Domain (done Oct 30, 2026): `fourcorners.ontrack-app.app` connected to the production Worker and set as Supabase Auth's site URL, before anyone in the group installs the app. An installed app and its sign-in belong to one address, so moving later means everyone reinstalls and signs in again
- QR (deferred to OT-74, Nov 5, 2026): each label encodes `https://fourcorners.ontrack-app.app/e/<id>`, built from the group's own address; the phone's camera opens the unit; a signed-out scan goes to sign-in and back. Label sheets as a PDF from an Edge Function `qr-labels` (per restaurant or selected units), sized for the group's label stock, about 2.5 in and adjustable
- Share link on a unit, in the same ellipsis menu as a ticket, using `/e/<id>`
- Create ticket from a unit, with the unit prefilled; the equipment breadcrumb with the restaurant color on every equipment screen
- Empty states: no equipment, no tickets on a unit, no service yet, QR not recognized; equipment loading skeletons

**Screens from the design:** Ops · Equipment list, Add equipment, Edit equipment, Equipment added + QR label, Equipment details, Equipment tickets, Equipment service history; Manager · Equipment, Equipment details and tickets tabs; Loading · QR scan, equipment list and detail; Empty · manager equipment, equipment tickets, new equipment; Error · QR code not recognized

**Demo milestone.** Seed the four restaurants with their real equipment where it is known, entered through Add equipment, since importing waits for Phase 7. Hand the assistant ops manager and one restaurant manager an install link, and let them run a real ticket for a week. Printed labels join the demo only if QR labels (OT-74) are back by then; the demo doesn't wait for them. The next-steps slide in the deck becomes the agenda for that conversation.

**Done when:** a manager at Logan Square finds a unit by browsing Back of House and its category, creates a ticket from it with the unit filled in, and the ticket shows up under that unit's Tickets tab and on the Ops dashboard; an Ops manager adds a unit, which then shows on that manager's list, and retires it, which takes it off the list and out of the ticket form's picker. Playwright runs it on WebKit. The original test, scanning a printed label on an iPhone, moves to OT-74 with the labels.

**Pull requests**

| PR | Scope |
| --- | --- |
| OT-65 | Plan update and this split; the Phase 3 note from trying push on Android |
| OT-66 | Equipment backend: Retire / Restore and Delete following the archive and delete rule (a history view, one `security invoker` function per action with its `audit_log` row), a guard so a retired unit or an archived restaurant takes no new ticket, the data plate photo, the list's counts (open tickets per unit and category, this year's spend only with `see_costs`), pgTAP |
| OT-67 | Ops equipment list: the restaurant picker, search, the filter sheet (area, category), category disclosures with open-ticket badges, rows with restaurant color, brand, serial and this year's spend, empty state, loading skeleton; View as |
| OT-68 | Manager equipment list: Front / Back and category disclosures, with no search (from feedback, Nov 5, 2026), Add equipment only with `edit_equipment`, empty state; View as |
| OT-76 | From feedback (Nov 5, 2026): swipe down closes a sheet, on every sheet in the app, when its content is scrolled to the top; past about a third of its height or a quick flick closes it, less springs back. Signed out never closes on a swipe, a swipe from a drag handle in Reorder restaurants keeps reordering, and a computer's centered dialog is unchanged. Tried by hand on Android and the borrowed iPhone |
| OT-77 | From feedback (Nov 5, 2026): a photo prompt on a manager's Create ticket. Submit ticket with no photo asks first, with Open Camera and Proceed without photo |
| OT-78 | From the Ops manager's ticket submission guide (Nov 5, 2026): Photo tips, a sheet with how to frame a photo and a drawn example, opened beside Add photo and from Add a photo? |
| OT-69 | Equipment detail for both roles: the breadcrumb with the restaurant color, Details (serial, brand, model, category, location, installed, warranty, manual), Tickets (open on top, closed in a disclosure), Service & cost only with `see_costs`, with its no-service-yet state until Phase 5; a ticket's equipment card now opens its unit |
| OT-70 | Add and Edit equipment: the form, manual PDF and data plate photo, Retire / Restore and Delete in a sheet with a confirm step; saving opens the new unit. Also, from feedback (Nov 5, 2026): a manager's equipment list opens with every card closed, as the Ops list does since OT-69 |
| OT-71 | Lasting link `/e/<id>` for every role and Share link on a unit; Create ticket from a unit with the unit filled in. Also (Nov 5, 2026): a closed Retired · N card at the bottom of the equipment list, for Ops and for managers with Add / edit equipment, so a retired unit can be found and restored; search finds retired units too, inside that card |
| OT-72 | Install prompt: the hook from Phase 0 put on a screen, with Android's Install button and iPhone's two-step picture |
| OT-73 | Security and code quality pass over what Phase 4 added |
| OT-74 | Deferred (Nov 5, 2026): QR labels. The QR on a unit's Details and Print QR label, the Equipment added + QR label screen and Save & create QR code, the scan button on a manager's list, Loading · QR scan and Error · QR code not recognized, `qr-labels` label sheets, the serial barcode button on the form. Labels about 2.5 in, adjustable. Waits on the iPhone link check |
| OT-81 | From feedback (Nov 6, 2026): the equipment lists' header button says Add, with room between it and the title |
| OT-82 | Faster CI: the App job's Playwright runs in Playwright's own image, as the flows do, since installing the browsers' system packages ran it out of time on OT-81 |
| OT-83 | From feedback (Nov 6, 2026): Add on a manager's In-house tab, for a task that isn't from a walkthrough; walkthrough tasks carry the Walkthrough tag |
| OT-84 | From an independent audit of Phase 4 (Nov 6, 2026): categories changed only by Ops and admins, the database picks a unit's id, a service record is about its ticket's unit and never deleted, a task once checked off stays on the record, a new ticket locks its unit |
| OT-85 | From feedback (Nov 6, 2026): closed in-house tasks older than 30 days sit behind Show older, still there to look at |
| OT-86 | From feedback (Nov 6, 2026): Categories for Ops and admins, from the ⋯ menu on Ops equipment: add, rename, turn off and on, delete only one never used, each logged |
| OT-79 | Fewer Actions minutes (Nov 5, 2026): the flows run once when a PR opens, or with the `flows` label, and not on `main` after a merge |
| OT-87 | Photo tips' drawing redrawn and smaller (Nov 8, 2026) |
| OT-88 | Outside the app (Nov 10, 2026): `design-system/`, a docs site and token editor that renders the app's own components and tokens, as its own Worker at `ktoc.dev/ontrack/design-system` |
| OT-75 | The done test as one flow; the phase note |

**What this phase has to work around**

- **QR labels are deferred (Nov 5, 2026; OT-74).** Equipment comes first, and how a scan opens the app on an iPhone isn't known yet, and the labels are about 2.5 in, a size that can be adjusted (from Ops, Nov 5, 2026). Until OT-74, a unit's Details tab shows the serial number in the card where the board draws its QR, with no Print QR label; Add equipment's button reads Save equipment and opens the new unit instead of the QR label screen; the subtitle saying a QR label is created when you save is left off; and a manager's list has no scan button. `/e/<id>` ships in OT-71 anyway, for Share link, and is the address labels will encode, so nothing printed later has to change.
- **A manager's equipment has no search (from feedback, Nov 5, 2026; OT-68).** A manager browses to a unit by Front / Back and then its category, so the board's search field and its No results board are left off, as on Open tickets (OT-63). The Ops list keeps its search, since it spans every restaurant.
- **The filter sheet on Ops equipment (OT-67)** has area and category only, since the restaurant picker at the top already scopes every Ops screen, as on the dashboard.
- **Closed tickets on each unit come back (OT-69).** Phase 3 left off Closed tickets' line saying closed tickets also appear on each unit; it returns once a unit's Tickets tab exists.
- **The Add equipment banner for importing a spreadsheet waits for Phase 7,** when Import equipment is built, so it is left off.
- **Retire and delete (OT-66, OT-70)** follow the archive and delete rule: a retired unit leaves the lists (it waits in a closed Retired card at the bottom from OT-71, as archived restaurants sit below the rest) and the ticket form's picker, keeps its history and opens from a ticket or a link with a Retired label, and can be restored. Delete is offered only while no ticket or service record points to the unit, and is disabled with the reason otherwise. No board draws the sheet, so it follows the restaurant one from OT-9.
- **The data plate photo** has no column or bucket yet; OT-66 adds it under `equipment-photos/<equipment id>/`, with the same scope rules as manuals, resized to 1600 px like ticket photos.
- **The install prompt (OT-72)** has no board. Chrome on Android can offer its own install sheet from a button; Safari on an iPhone has no such call, so the app shows the two steps (Share, then Add to Home Screen). It appears once after signing in, on a phone that hasn't installed the app, and stays as a row on Profile until it is installed. It matters most for iPhone, where push works only from the installed app. Built (Nov 6, 2026): an Install OnTrack sheet, opened once per phone the first time a tab-bar screen opens and the browser can install (remembered on the device, so a second person on that phone isn't asked again), never on a computer or under View as. On Android, Install opens Chrome's own sheet, and Not now closes it; Chrome's offer is spent once used, so the Profile row goes until Chrome offers again. On an iPhone it shows the two steps with Safari's icons and says notifications only work from the Home Screen. Profile has Install the app under This device while the browser can install it. Chrome's offer comes early in a page's life, so the app keeps it from the start. Every Playwright test starts on a phone that was already offered it (`storageState` in both configs), and `e2e/install.spec.ts` starts without; a real install is tried on Android and the borrowed iPhone.
- **A photo with every ticket, asked for, not required (from feedback, Nov 5, 2026; OT-77).** The ops manager wants a photo on each ticket. So when a manager taps Submit ticket on Create ticket with no photo on the form, a sheet titled "Add a photo?" says "It is best practice to include a photo with a ticket." and offers Open Camera, the primary button, and Proceed without photo, a danger button. Open Camera opens the phone's camera (on a computer, the file picker), and the photo joins the form like any other, so the manager sees it and taps Submit ticket again. Closing the camera with no photo, or swiping the sheet away, leaves the form as it was and creates nothing. Proceed without photo creates the ticket as before. It is a nudge, not a rule: the database still accepts a ticket with no photo, a manager's later updates aren't asked, and Ops isn't asked when posting. No board draws the sheet.
- **Photo tips (from the Ops manager's ticket submission guide, Nov 5, 2026; OT-78).** Directions and area nicknames don't always help a technician find a unit, so the guide asks for a photo that shows what is around the unit and has its ID label and maker in the frame, with the problem in a second photo if it helps, and safety first. A Photo tips link beside Add photo on Create ticket, and under the buttons on Add a photo?, opens a sheet with those four tips and an example. The guide's example is a real photo of one of the group's bars, which can't ship in the app (no restaurant data in the repo, and another group may run it), so a line drawing made from it stands in (Katie's, Nov 5, 2026; OT-80): a cooler under a bar with the guide's blue and yellow boxes, and the labels as text on top, so they stay sharp and are read out. It is a 157 KB WebP, dimmed a little in dark mode and no taller than about half the screen. If the group wants their own photo there, it would be group content in storage, set per deployment. No board draws the sheet.
- **A unit's page (OT-69)** is one screen for both roles, each as its boards draw it: Ops has the restaurant and Installed in the header and the details in a card under a label; a manager's details sit on the screen. The tabs are routes (`/equipment/<id>`, `/tickets`, `/service`, and the same under `/ops`), so Back returns to the tab. A detail with no value is left out rather than shown empty. Closed tickets sit under a disclosure, open to begin with, for both roles (the Ops board lists them plainly). Service & cost is for Ops only (from feedback, Nov 5, 2026): a manager won't need it, so it is gone for managers whatever their rights, though one with See costs still sees what each closed ticket cost. The Tickets tab's badge is the number alone, for both roles (from the same feedback). On the equipment lists, a card's head keeps its "1 open" pill and each unit inside it gets a quieter dot and "1 open" with no fill, so the open card doesn't repeat the same pill down its rows. The Ops equipment list opens with every card closed (from feedback, Nov 5, 2026), where the board opens the first; a manager's list does the same from OT-70 (from feedback, Nov 5, 2026). A contractor's amount is this year's on the unit, as the board's is, and one who worked on it only in earlier years says so. The service log is grouped by year and its rows open nothing until Phase 5 builds the service record, and Log service waits for Phase 5 too, so the empty Service & cost says what will show up there instead of asking to log. Edit comes with OT-70 and Create ticket for this equipment with OT-71. The manual opens through a signed link; a file that won't sign shows as its name. A ticket's equipment card opens the unit, and Closed tickets has the board's note again ("Closed tickets also appear on each piece of equipment, with their costs", the last part only with See costs). The empty Closed tickets board's line that a closed ticket is saved to its unit's service history stays off, since closing logs no service.
- **Add and Edit equipment (OT-70)** follow the boards, for Ops and for a manager with Add / edit equipment, who has no board and gets the same form at their restaurant (no Restaurant field when they have one). It opens on Back of House, as the board does. Installed and Warranty through are the phone's own month pickers; a month left as it was keeps its day, and changing the warranty drops the old free-text warranty note, so the unit's page then reads "Through Oct 2029". The manual is a PDF up to 50 MB, saved under its own name; the data plate photo is shrunk to 1600 px, and the unit's page gets a Data plate row with View photo, which no board draws. The row is saved first and its files after, so a file that fails leaves the unit saved and says so. While anything points to a unit its Restaurant is locked, with the reason, since the database refuses the move. Edit is on a unit's page for anyone with Add / edit equipment. Retire this equipment, at the bottom of Edit as the board draws it, opens a sheet that confirms and offers Delete instead, disabled with the reason when the unit has history; a retired unit's link reads Restore this equipment. Deleting removes the unit's manual and photo first, after checking again that nothing points to it.
- **The Service & cost tab is mostly empty until Phase 5,** which logs service, so the live app shows the no-service-yet state; the seeded stack shows the full board.
- **Security and code quality pass (OT-73, Nov 6, 2026).** What Phase 4 added was read through, from `20261105120000` on, the equipment and in-house screens, the links and the install prompt, and probed on the local stack through the API and Storage. Three fixes, in `20261106130000_phase4_audit.sql` with `35_phase4_audit.test.sql`. (1) Files that belong to nothing: `can()` reads a null restaurant as any, and a storage path whose first folder names no unit gave null, so a manager with Add / edit equipment at one restaurant could upload to, read and remove files in `manuals` and `equipment-photos` under a made-up folder, or a deleted unit's, and the same held in `invoices` with Log cost or See costs; each policy now needs the unit or service record to exist. The tables were never open this way, since their foreign keys are not null. (2) A person's in-house task is a hand-added one: no walkthrough, check, origin or converted ticket, so the Walkthrough tag can't be claimed, and its date is the database's. (3) A unit keeps its id on update. Checked and fine: retire, restore and delete check the caller first and log; a retired unit or an archived restaurant takes no ticket, on insert or change; a unit moves only while unused and with Add / edit equipment at both ends; signed links last an hour; file names are cleaned; the lasting link and the form's Back go through `safeReturnPath` or the role's path. Code quality: the Closed tickets note's test turned on whether anything had closed this month, so it now sets the browser in October 2026; doc comments that earlier edits left unwrapped were rewrapped.
- **Categories (from feedback, Nov 6, 2026; OT-86).** Categories are the group's, shared by every restaurant, and Ops looks after them, since Ops knows what is on the ground; admins can too. Ops opens Categories from the ⋯ menu beside Add on Equipment (with Add / edit equipment), an admin from a row on Restaurants. Front and Back of House list theirs in order, turned-off ones under their own label with an Off tag. Add takes a name and an area and puts it at the end; a name already used in that area is refused, whatever its case. A row's sheet renames it (everywhere, old tickets included), turns it off or back on, or deletes it while no ticket or unit has used it, disabled with the reason otherwise, following the restaurant sheet from OT-9. A turned-off category leaves Create ticket and the equipment form, except a unit that already has it keeps it on its form, and the database refuses it on a new ticket or unit; what already uses it keeps it. Each change goes through a function that checks the caller and logs it, and nobody writes categories around them (`20261106150000_categories.sql`, `37_categories.test.sql`). No board draws it.
- **Old closed in-house tasks (from feedback, Nov 6, 2026; OT-85).** A finished task is a record, so it is never deleted, but Closed doesn't have to grow forever: it shows what was checked off in the last 30 days, latest first, and older ones wait behind Show older (N) at the bottom, under "Checked off more than 30 days ago". Nothing to tidy by hand, and nothing lost. No board draws it.
- **An independent audit (OT-84, Nov 6, 2026).** After OT-73, a separate agent with none of this context audited the same scope and probed the local stack. Its four proven findings were reproduced and fixed in `20261106140000_phase4_audit_followup.sql` with `36_phase4_audit_followup.test.sql`. (1) Categories are the group's, but a manager granted Add / edit equipment at one restaurant could rename, add or delete them for every restaurant, unlogged; now only Ops with Add / edit equipment and admins change them, and none are deleted through the API (decided Nov 6, 2026: Ops knows what is on the ground, and admins can too; OT-86 gives them a screen). (2) A client chose a new unit's id, so a deleted unit's id could be taken again to reach its leftover files; the database now picks it, and the app stops a Delete when a file won't go. (3) A service record could name a unit at another restaurant, putting spend on it and keeping it from deletion, and could be deleted; its unit is now always its ticket's, and records are never deleted. (4) A checked-off in-house task could be unchecked, unlogged, and then deleted; unchecking is now logged and a task once checked off is never deleted (`first_done_at`), so its Delete is gone. A fifth, a ticket created on a unit at the moment Ops moves it, was reasoned rather than reproduced; a new ticket now locks its unit while it checks it.
- **A unit's link and Create ticket (OT-71).** `/e/<id>` opens the unit's page for a manager or Ops, through sign-in when signed out, and grants nothing, so a unit outside someone's scope is not found; admin and leadership have no equipment screen, so it says so, as a ticket link does. Share link is in an ellipsis menu beside Edit on every unit, as on a ticket; no board draws it. Create ticket for this equipment is the bar a manager's boards draw at the bottom of a unit, for a manager with Create tickets at that restaurant; it opens the form on the unit's category with the unit chosen, its Back returns to the unit, and saving goes to Open tickets as usual. The Ops boards draw no such bar, and Ops has no Create ticket, so it is a manager's only, and a retired unit has none. The Retired card (Ops, and a manager with Add / edit equipment) sits closed at the bottom of the list with its count; a search or filter reaches retired units too, inside it, and opens it as it opens the other cards.
- **In-house tasks by hand (from feedback, Nov 6, 2026; OT-83).** Plenty of what a restaurant fixes itself never needs Ops or a unit, like cleaning the grease under the prep table, so a manager adds a task from the In-house tab, not only from a walkthrough. Add opens a sheet with the task (up to 140 characters, as a ticket's title), Front or Back, opening on Front of House as Create ticket does, and the restaurant for someone with more than one. It is not a checkbox on Create ticket: a task has no category, unit, urgency, photos or thread, and a box ticked by mistake would keep a real repair from Ops. Tasks notify nobody, and pgTAP checks that. A walkthrough's task (or a quarterly one) has the Walkthrough tag before its origin line; one added by hand reads "Added by Maya · Nov 6". Add is there for anyone with Create tickets, and gone under View as. No board draws the sheet.
- **View as:** each equipment screen scopes its data from `useUser()` and hides Add, Edit, Retire and Delete when `viewingAs` is set.

## Phase 5 · Contractors, service records and invoices

Every repair gets a cost, a contractor and an invoice, and the spend views on equipment, contractors and the dashboard start showing real numbers. This is the section of the deck the head of ops is paying for.

**Ships**

- Log service from a ticket: in-house or contractor, contractor select with "Add new", technician, invoice number, service date, labor, parts, trip fee with a live total, work notes, attach invoice; the inline saving state
- Service record: invoice card (view, download, replace, missing state), cost breakdown, details; Edit service record with delete
- Contractor directory: search, trade chips, sort by spend or last used, preferred stars, insurance-expiring flags, one-tap call and email
- Contractor detail: spend, visits, last visit, details, Visits and Invoices tabs; Add and Edit contractor with the preferred switch
- Share link on a contractor, in the same ellipsis menu as a ticket, using `/c/<id>`, which refuses anyone without `see_contractors`
- Invoices tab: by month, missing-invoice filter and count, sort, rows linking to service records
- Spend views in Postgres feeding the ticket total, unit lifetime and yearly cost, contractor spend and visits, and the Closed tab month totals
- Empty states: contractor directory, contractor search; the Add contractor link from Log service

**Screens from the design:** Ops · Log service & cost, Service record, Edit service record, Contractor directory, Contractor detail, Add contractor, Edit contractor, Invoices; Loading · inline button spinner; Empty · contractor directory; No results · contractor search

**Done when:** logging a $397.40 Coldline visit on a ticket raises that unit's 2026 cost, Coldline's spend, and the Closed tab's month total by the same amount, with the invoice PDF openable from all three places.

**Pull requests**

| PR | Scope |
| --- | --- |
| OT-89 | Plan update and this split; the Phase 4 note from the live demo |
| OT-90 | Service backend: a ticket becomes optional on a service record, which gets its own `restaurant_id` (filled from the ticket for every existing row), and the policies, `service_record_restaurant()` and the invoice storage rules read it; with a ticket, the restaurant and unit are the ticket's, as since OT-84; without one, the unit is optional and must be at that restaurant and not retired. `log_service` and `update_service_record`, each one step that checks `log_cost` at the record's restaurant, writes the record, its line items and its invoice row together and logs it in `audit_log`; no delete; the invoice file under `invoices/<service record id>/`; the spend views (ticket total, unit lifetime and this year, contractor spend, visits and last visit this year, month totals), all `security_invoker` so they need `see_costs`; pgTAP |
| OT-91 | Contractors backend by the archive and delete rule: `save_contractor`, `set_contractor_archived` and `delete_contractor` (only with no service records), each checking the caller and logging; trade from a fixed list; an archived contractor takes no new service; pgTAP |
| OT-92 | Log service & cost, from an Ops ticket (the ticket filled in), from a unit's Service & cost (the unit filled in, a ticket optional) and from a contractor's page (restaurant, then a unit and a ticket, both optional): In-house or Outside contractor, the contractor picker (preferred first, "+ Add new contractor"), technician, invoice number, service date, labor, parts and trip fee with a live total, work notes, Attach invoice; the inline saving spinner and the save-failed state; the ticket's Service & cost section with its running total |
| OT-93 | Service record: invoice card (View, Download, Replace, and Missing with Attach), cost breakdown, details linking to the contractor, the unit and the ticket; Edit service record without Delete, where a ticket can be added or changed; opened from a ticket, a unit's service log, a contractor's visits and Invoices; a record with no ticket leaves out the Ticket row |
| OT-94 | Contractor directory: search, trade chips with counts, Most used first or by spend, preferred stars, insurance flags 30 days out, one-tap call; its empty state and No results; the Contractors tab replaces its placeholder; View as |
| OT-95 | Contractor detail: spend, visits and last visit, details, Call and Email, Visits and Invoices tabs; Add and Edit contractor with the preferred switch; Archive / Restore and Delete sheet; lasting link `/c/<id>` and Share link, refused without `see_contractors` |
| OT-96 | Invoices tab: by month, the Missing filter and its count, sort, search by contractor, unit, ticket or invoice number, the month's count and total, rows opening the service record |
| OT-97 | Security and code quality pass over Phase 5 |
| OT-98 | The done test as one flow; the phase note |
| OT-99 | From feedback (Nov 12, 2026): a contractor has one or more trades, linked through `contractor_trades` to a `trades` table that replaces the fixed list; `save_contractor` takes the trades; Trades for Ops with Log cost and admins (from Contractors' menu and from Restaurants), by the archive and delete rule like Categories; the add sheet picks trades with chips, a card shows a tag for each, and every chip of theirs finds them; pgTAP and a flow |

**What this phase has to work around**

- **A service record is never deleted (OT-84).** Edit service record draws "Delete this record"; the archive and delete rule makes a service record part of the record, so it is left off, and a mistake is edited, with the edit logged. A record logged on the wrong ticket is corrected by Ops in the database until someone asks for a way in the app.
- **Contractors follow the archive and delete rule.** No board draws Archive or Delete, so the sheet follows the restaurant one from OT-9: Archive takes a contractor out of the directory and the Log service picker and keeps their visits; Delete is there only while no service record names them. Today `contractors` is written straight through the API with `log_cost` and no log; OT-91 moves every write into functions.
- **A visit needs no ticket (decided Nov 11, 2026).** Ops shouldn't have to open a ticket to log a contractor's visit, like a preventive maintenance call, so the ticket is optional. The schema from Phase 0 hangs every service record on a ticket and takes its restaurant from there, so OT-90 gives a record its own restaurant and loosens the ticket. Log service opens from a ticket, as the board draws, and also from a unit's "+ Log service" (the unit's board) with a ticket optional, offering that unit's open tickets first, and from a contractor's page, which no board draws, starting with the restaurant. A visit with no ticket counts toward the unit's cost, the contractor's spend and Invoices, but not the Closed tab's month totals, which are about closed tickets.
- **Line item descriptions.** Service record shows "Labor · 2 hrs" and "Parts · fan motor, capacitor", but Log service and Edit only ask for amounts. The descriptions show when there are some (the seed has them) and the forms leave them off, as the boards do.
- **The invoice amount** is the record's total; the invoice row holds its number, file and status (attached or missing), so a record logged with no file shows under Missing until one is attached.
- **Restaurant scope.** Contractors are the group's, shared by every restaurant, so the directory lists every one; the spend, visits and invoices on it follow the restaurant picker at the top, as the dashboard does. Who sees what is `see_contractors` for the directory and `see_costs` at a restaurant for any amount; logging needs `log_cost` at the record's restaurant, Ops by default.
- **Several trades per contractor (from feedback, Nov 12, 2026; OT-99).** Some contractors do more than one thing, like refrigeration and HVAC, so a contractor has one or more trades, where the boards draw one Trade dropdown. They are picked with chips you tap on and off, the style Invite user uses for restaurants, and a card shows a tag for each, wrapping when needed. The trade list is no longer fixed: Ops with Log cost and admins add, rename, turn off and delete trades on a Trades screen that follows Categories, since no board draws one. A turned-off trade leaves the choices, and contractors who have it keep it.
- **The contractor page and its forms (OT-95).** The page's spend, visits and both tabs follow the Ops restaurant picker, as the directory does, and a line says which restaurant when it is one. The board draws no way to log a visit there, so Log service sits in the ⋯ menu with Share link, and an empty Visits tab offers it. Contact name and phone are required on Add and Edit, as the boards draw them; the quick sheet in Log service still asks only for the name, trades and an optional phone, so a contractor added there gets the rest when someone edits them. Insurance is a month, kept as the month's last day. The board's "Remove contractor" opens Archive, with Delete instead while no visit names them; an archived contractor's page says Archived, and the directory lists archived contractors under a closed Archived disclosure at the bottom, so they can be restored.
- **The Import contractors banner on Add contractor and the empty directory waits for Phase 7,** when Import contractors is built, so it is left off.
- **Leadership's read-only contractor and invoice screens are Phase 7's.** A contractor link opened by leadership says so, as a ticket link does.
- **View as:** each screen scopes its data from `useUser()` and hides Add, Edit, Log service, Attach and Replace when `viewingAs` is set.

## Phase 6 · Monthly walkthroughs

Managers walk a checklist each month, log fixes and tickets as they go, and Ops sees who is on track. It is the biggest phase, so it is split into two halves that each ship on their own.

**6a · The manager's walkthrough**

- Walkthrough home for the month: progress by area, due date, what is flagged; the all-done state
- Checklist by area (BOH, FOH, quarterly tasks) with the per-item Good / In-house / Ticket controls, group disclosures, the help panel
- Quick ticket sheet from an item (creates a ticket with `source = walkthrough` and the Walkthrough tag), and the walkthrough edit/close ticket screen
- In-house fixes: the shared list opened filtered from an item or whole from review, check off, delete with confirm; tasks added by hand on the In-house tab (OT-83) sit in the same list, without the Walkthrough tag
- Review & submit with the partial-submit warning; the all-tickets list from review
- Walkthrough creation: `pg_cron` opens next month's walkthrough per restaurant from its schedule; reminders 7 and 2 days before due go out by push and email

**6b · Ops and the schedule**

- Ops walkthroughs overview: progress per restaurant, submitted dates, the last-6-months list; one restaurant's walkthrough with flagged items, the reminder button, past walkthroughs
- Ops in-house fixes view, read-only with Convert to ticket
- Walkthrough schedule: group rotation, per-restaurant own schedule and switch back, the 12-month preview, settings
- Quarterly tasks: group list with per-restaurant overrides, removals and restores, the task editor with directions and video link
- Checklist template editor so Ops can change the items without a deploy (the design has no screen for this yet; a simple list editor is enough)

**Screens from the design:** Walkthrough · Manager (11 screens: this month, checklist, quick ticket, quarterly task, all done, review, partial warning, in-house fixes from item and from review, edit ticket, all tickets); Ops (5 screens: all restaurants, one restaurant, schedule, quarterly tasks, in-house fixes)

**Done when:** October's walkthrough is created automatically for all four restaurants, a manager submits one from a phone with two tickets and one fix, those tickets show the Walkthrough tag on the Ops dashboard, and the Ops overview shows one of four submitted.

## Phase 7 · Leadership, Admin tickets and imports

The read-only views for leadership and admin, and the spreadsheet imports that make a real rollout to all nine restaurants practical. Ops runs the imports of equipment and other data, as it manages categories (decided Nov 6, 2026); admins can too.

**Ships**

- Leadership: Overview (open, urgent, spend, time to close, by restaurant), Restaurant view with open tickets and equipment, Ticket detail, Contractors directory and invoices, Contractor detail, Service record, Walkthroughs; all read-only, driven by the same views as Ops
- Admin: Tickets list and ticket detail, read-only with the view-only banner
- Import contractors and Import equipment: choose a file (xlsx or csv), match columns with guesses and one-tap suggestions, review rows with grouped fixes and duplicate handling (skip or update), done screen with counts, QR labels for imported units, 24-hour undo. Parsing and matching run in an Edge Function `import` so the phone only uploads the file
- Import template downloads for both lists
- Entry points: the banners on Add contractor and Add equipment, the button on the empty contractor list

**Screens from the design:** Leadership (9 screens plus 2 empty states and the loading skeleton); Admin · Tickets, Ticket detail; Ops · Import contractors 1 to 4, Import equipment 1 to 4

**Done when:** the assistant ops manager imports the group's real contractor spreadsheet from a phone with no help, and leadership can open the Overview on a laptop and see the same totals Ops sees.

## Phase 8 · Desktop layouts, offline, and later

These come after the group is using the app daily, in whatever order the feedback puts them.

- **Desktop layouts.** Tablet and desktop up to 1440 px: the tab bar becomes a sidebar, lists become list-plus-detail panes, sheets become dialogs, and the import review becomes a table. The phone layouts stay as the base; this is CSS and a few layout components, not new screens
- **Offline.** Cache the lists and tickets you have opened; queue new tickets and updates with the Not sent yet card and the Saved-at banner; retry on reconnect; handle a conflict by appending, never overwriting. This is the Error · Offline screen from the design
- **Reports.** Monthly spend per restaurant and per category as a PDF or CSV for leadership; repeat-repair flags on a unit
- **Microsoft 365 sign-on,** if another group needs it; Google sign-in moved up to OT-59, now deferred until the group's IT person is involved
- **App Store wrapper** with Capacitor only if someone asks for it; the PWA covers the need
- **Second restaurant group.** Each group gets its own deployment from the same repo: its own Supabase project, its own Cloudflare Worker on `<group>.ontrack-app.app`, and its own `group_settings` row. No policy changes, and one group's data cannot reach another's, because they share no database. The deploy workflow pushes migrations to each project. The cost is one more Supabase project per group. A shared database with a `group_id` on every table is cheaper to run, but it changes every policy and makes a cross-group leak possible, so it waits until there are enough groups to justify it

## Working method

One person with AI help can move fast on this stack as long as every phase has the same shape: schema and policies first, then the screens against the design, then a Playwright flow that proves the done test. Order inside a phase:

1. **Migration and policies.** Write the tables, the `can()` cases and the pgTAP tests for the phase before any UI. Docker Desktop runs on the dev machine (since Oct 30, 2026), so pgTAP and the stack flows run locally before a push, and CI runs them again on every PR
2. **Data hooks.** One TanStack Query hook per screen's data, typed from the generated Supabase types (CI builds them as the `database-types` artifact), with the seed data as fixtures
3. **Screens against the design.** Build each screen from its board on the design canvas, in both themes, in the `/kit` page first when a new component is needed. The canvas's sample data and the seed data match on purpose, so a screen is done when it looks like its board
4. **Flow test.** One Playwright test per phase on Chromium and WebKit, driving the done test end to end against the seeded local stack (`app/e2e/stack`)
5. **Preview and try on a phone.** Every branch gets a Cloudflare preview URL; open it on a phone (Android today) before merging. A pass on a real iPhone before each milestone handed to the client

**Conventions**

- Small pull requests, one screen or one function each, merged to `main` only when CI is green; `main` deploys to production (Workers Builds) and applies migrations (`supabase-deploy.yml`) automatically
- A `CLAUDE.md` in the repo holding the stack, the folder layout, the token names, the done test for the current phase and the rules from the earlier doc (16 px inputs, `100dvh`, safe areas), so each AI session starts with the same context
- No restaurant data in the repo; the seed is fictional except restaurant names and colors
- Secrets only in Supabase and GitHub Actions settings, never in `.env` files that get committed. The Cloudflare build variables hold only the two public values
- Each phase ends with a short written note of what changed and what the client should try, which becomes the message to the ops team

**What done means for a phase:** its done test passes in CI on both engines, the screens match their boards in light and dark, RLS tests cover its tables, and it has been tried on a real phone from the preview URL.

## Design reference

The agents building each phase cannot open the design canvas or the slide deck, so the design is exported into the repo as a `design/` folder (the `ontrack-design.zip` from October 28). It is the source of truth for how every screen looks; the canvas stays the place where the design changes, and the folder is re-exported whole when it does.

| File | What it holds | When an agent reads it |
| --- | --- | --- |
| `design/INDEX.md` | Every screen: file name, title, role, and the phase it belongs to | At the start of a phase, to list the screens to build |
| `design/screens/<Name>.dc.html` | The screen's markup, CSS, copy and sample data as drawn on the canvas, with its `data-props` states and the `href` links that define navigation | Before building or changing that screen |
| `design/screens/<Name>.png` | The same screen rendered at 390×844, light mode, 2x | Alongside the HTML, as the picture to match |
| `design/tokens.md` | Colors, type scale, status pill colors and icons, restaurant colors and presets, radii, spacing, and the proposed dark theme | When setting up Tailwind and the CSS variables in Phase 0, and whenever a value is in doubt |
| `design/canvas.json` | Board positions and section titles from the canvas | Rarely; it shows how screens group on the board |
| `design/README.md` | How to use the folder and the rule to paste into `CLAUDE.md` | Once, when the repo is set up |

The rule that goes in the repo's `CLAUDE.md`, so every agent session follows it: before building or changing any screen, read its file in `design/screens/` and look at its PNG; match it, do not reinterpret it; styles come only from `design/tokens.md`; a phase is done when every screen listed for it in `design/INDEX.md` renders on a phone and matches its PNG, in light and dark mode.

Two things the export does not carry. The screens are light mode only, so dark mode is built from the proposed values in `tokens.md` and checked in `/kit` before any screen uses it. And the HTML files depend on the canvas runtime, so they are read, not run; the PNG is the rendered view, and a new state that needs a picture gets a fresh export rather than a hand edit.

The slide deck is for people, not agents. If a screen in the deck and the same screen in `design/` ever disagree, `design/` wins, and the deck gets updated from the canvas.

## Risks and open items

| Risk | Why it matters | What to do |
| --- | --- | --- |
| iPhone push only works when the app is installed to the home screen | The ops team may open it in Safari and wonder why nothing buzzes | Install prompt with a two-step picture on iPhone (OT-72; the hook has existed since Phase 0, but no screen used it); email on by default; Profile shows whether push is on |
| RLS policies get complex with per-person rights overrides | A bug here leaks another restaurant's data | Every rule goes through one `can()` function with pgTAP tests per role; never a second code path in the app |
| Supabase free tier pauses after a week idle | A paused project during the pilot looks like a crash | Move to Pro ($25 a month) before handing the app to the client |
| An iPhone may open a link in Safari and not the installed app | Safari has its own sign-in, so a shared link, a notification's email link or a QR scan could ask for a password first. Not yet tried on an iPhone | Deferred with QR labels (Nov 5, 2026): check on a borrowed iPhone before OT-74 builds them, since the answer decides how a scan opens a unit. Signing in on the way still lands on the right page |
| QR labels bake in the domain | Reprinting labels is a real cost once they are on units | `fourcorners.ontrack-app.app` is connected (Oct 30, 2026), so print from that; use a short path like `/e/` so labels stay small |
| Resend domain needs DNS records before invite emails land in inboxes | First invites bounce or go to spam | SPF, DKIM and DMARC are set on `ontrack-app.app`, and a real invite reached a Gmail inbox (Oct 30, 2026). Four Corners uses Gmail only; test another provider when a group uses one |
| The walkthrough phase is large | It can stall the pilot | It is after the demo milestone and split in two; 6a alone is useful |
| A secret pasted into a `VITE_` build variable | It ships in the public JavaScript; on Oct 28 a Supabase personal access token went out in the OT-3 preview this way and was revoked | Only the URL and the `sb_publishable_` key go in Cloudflare; check the key's prefix when setting a new branch's variables |
| Solo build with AI help drifts from the design | Screens that look close but not right erode trust with a team that already struggled with the canvas | Build from the boards one at a time, check both themes in `/kit`, and put the preview on a phone before merging |

**OT-23**

- [x] Remove the "Looks a lot like a color already in use" warning from Add restaurant; two restaurants may then look alike, which is accepted. An exact match is still refused, and so are the reserved brand and urgent colors
- [x] Add Edit restaurant (name, address, phone, color), reusing the Add form. It opens from the restaurant's sheet, archived ones too, and logs what changed. There is no board for it
- [x] Signing back in after a deliberate sign-out goes to the role's home, not the page they left; only a timed-out session returns to its page
- [x] A refresh says "Loading…", not "Signing you in…"
- [x] Remove the silent fallback to the Resend test sender, so a missing `EMAIL_FROM` gives a clear error in the function log

**Open items**

- [x] Buy `ontrack-app.app` and connect it to the production Worker
- [x] Connect `fourcorners.ontrack-app.app`, so QR labels and emails have a stable base
- [x] Set `APP_URL` (Edge Functions, Secrets) and the Site URL (Authentication, URL Configuration) to `https://fourcorners.ontrack-app.app`, so emails link there (Oct 30, 2026)
- [x] Set up `ontrack-app.app` as the Resend sending domain, which replaces the `onboarding@resend.dev` test sender
- [x] Add the live address to the hosted Supabase project's Auth site and redirect URLs
- [x] Try the invite flow on two devices, which is the Phase 1 done test as written (Oct 30, 2026)
- [ ] Notifications for the promises the Roles & rights and User profile boards make ("everyone affected is notified"). Phase 3 kept them off, since rights changes notify nobody; not scheduled, and those screens stay without the line until someone asks for it
- [ ] View as answers from the admin's own access, scoped by the app. Each screen added from Phase 2 on must scope its data from `useUser()` and hide writes when `viewingAs` is set
- [x] For Google sign-in (OT-59): is the group on Google Workspace, with addresses on its own domain, not ordinary `@gmail.com` ones? Yes, on its own domain (Nov 4, 2026, from Ops)
- [ ] For Google sign-in: who runs the group's Google admin account, to help set up the sign-in connection? An IT person does, not yet involved; Ops was unsure how they would take the change, so Katie will try to reach them, or the other Ops manager first for more background
- [x] For Google sign-in: does everyone have a work Google account, including every manager, Ops, leadership and any outside people? Yes (Nov 4, 2026, from Ops)
- [ ] For Google sign-in: is anyone on an iPhone? If so, the installed-app test decides the approach. Not known yet; the managers need asking
- [ ] The real walkthrough checklist items per area (the design has 48 placeholders)
- [ ] Who at Four Corners is the first admin, and whether the head of ops wants admin or ops (Katie holds the only admin account until then, and an only admin who loses their phone and backup codes can be recovered only by a line of SQL, so a second admin removes that risk)
- [x] Turn off or delete a category, following the archive and delete rule: built in OT-86 for Ops and admins (Nov 6, 2026), after OT-84 limited the writes to them
- [ ] Whether an admin may post in a ticket thread. Leadership can't since OT-28, but an admin still can through the API, though no screen offers it. Phase 7 builds the admin's view-only tickets, so decide there
- [x] How a manager finds a closed ticket: an ellipsis menu beside the search on Open tickets opens a simple list, in OT-33 (Nov 1, 2026)
- [x] Whether Edit ticket should offer the title: yes, in OT-33 (Nov 1, 2026)
- [x] Sharing a link to a ticket, a unit or a contractor: lasting links that work for every role, then Share link in the ellipsis menu, across Phases 3, 4 and 5 (Nov 1, 2026)
- [ ] Whether Ops wants a filter sheet on the dashboard. Saved for later, not scheduled (OT-38, see Phase 3)
- [x] Label stock size for the QR sheets: usually around 2.5 in, and it can be adjusted (Nov 5, 2026, from Ops). OT-74 sizes labels at 2.5 in by default, with the size a setting on the sheet
- [x] Whether a contractor's visit must have a ticket: no, it is optional, so a preventive maintenance call is logged straight on a unit or a restaurant (Nov 11, 2026; see Phase 5)
- [ ] Whether SMS 2-step is wanted, given its per-message cost
- [ ] Whether admins should keep "Don't ask again on this phone for 30 days". It follows the board for now: on for everyone and checked by default
