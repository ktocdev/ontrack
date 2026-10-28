# OnTrack design index

Every screen on the design canvas, one row each. `File` is the screen source in `screens/`; the PNG beside it is the rendered phone view at 390×844 in light mode. `Phase` is the build phase from the build plan that delivers it. Sections follow the canvas (top to bottom).

| Board section | File | Title on the canvas | Role | Phase |
| --- | --- | --- | --- | --- |
| 1 · Admin / IT — invite & onboarding | `Empty-Admin-Users.dc.html` | Empty · Admin users (just you) | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `Admin-Roles.dc.html` | Admin · Roles & rights | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `Admin-Invite.dc.html` | Admin · Invite user | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `Invite-Email.dc.html` | Invite email | Any | 1 |
| 1 · Admin / IT — invite & onboarding | `Loading-Invite.dc.html` | Loading · Centered spinner (checking invite link) | Any | 0 |
| 1 · Admin / IT — invite & onboarding | `Account-Setup.dc.html` | Set up account | Any | 1 |
| 1 · Admin / IT — invite & onboarding | `Sign-In.dc.html` | Sign in | Any | 1 |
| 1 · Admin / IT — invite & onboarding | `Loading-Admin-Users.dc.html` | Loading · People list skeleton (Admin users) | Admin | 0 |
| 1 · Admin / IT — invite & onboarding | `Admin-Users.dc.html` | Admin · Users | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `Admin-User-Override.dc.html` | Admin · User profile (role, rights, security) | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `View-As.dc.html` | Admin · View as Maya (read-only) | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `Admin-Tickets.dc.html` | Admin · Tickets (read-only) | Admin | 7 |
| 1 · Admin / IT — invite & onboarding | `Admin-Ticket.dc.html` | Admin · Ticket detail (read-only) | Admin | 7 |
| 1 · Admin / IT — invite & onboarding | `Admin-Restaurants.dc.html` | Admin · Restaurants | Admin | 1 |
| 1 · Admin / IT — invite & onboarding | `Admin-Add-Restaurant.dc.html` | Admin · Add restaurant | Admin | 1 |
| 2 · Restaurant manager | `Empty-Manager-Tickets.dc.html` | Empty · Manager open tickets | Manager | 2 |
| 2 · Restaurant manager | `Main.dc.html` | Manager · Open tickets | Manager | 2 |
| 2 · Restaurant manager | `Ticket.dc.html` | Manager · Open ticket (updates & replies) | Manager | 2 |
| 2 · Restaurant manager | `Edit-Ticket.dc.html` | Manager · Edit / close ticket | Manager | 2 |
| 2 · Restaurant manager | `Create-Area.dc.html` | Manager · Create ticket: area | Manager | 2 |
| 2 · Restaurant manager | `Create-Form.dc.html` | Manager · Create ticket: form | Manager | 2 |
| 2 · Restaurant manager | `Loading-Equipment-List.dc.html` | Loading · Grouped list skeleton (Equipment) | Any | 0 |
| 2 · Restaurant manager | `Equipment-List.dc.html` | Manager · Equipment | Manager | 4 |
| 2 · Restaurant manager | `Loading-Scan.dc.html` | Loading · Centered spinner (QR scan lookup) | Any | 0 |
| 2 · Restaurant manager | `Loading-Equipment-Detail.dc.html` | Loading · Detail skeleton (Equipment details) | Any | 0 |
| 2 · Restaurant manager | `Equipment-Detail.dc.html` | Equipment · Details tab | Manager | 4 |
| 2 · Restaurant manager | `Equipment-Tickets.dc.html` | Equipment · Tickets tab | Manager | 4 |
| 2 · Restaurant manager | `Closed-Ticket.dc.html` | Manager · Closed ticket (reopen if the problem is back) | Manager | 2 |
| 2 · Restaurant manager | `Main-InHouse.dc.html` | Manager · Open in-house tasks | Manager | 2 |
| 2 · Restaurant manager | `Empty-Search-Tickets.dc.html` | No results · Manager ticket search | Manager | 2 |
| 2 · Restaurant manager | `Empty-Manager-Equipment.dc.html` | Empty · Manager equipment | Manager | 4 |
| 2 · Restaurant manager | `Empty-Equipment-Tickets.dc.html` | Empty · Equipment tickets tab | Manager | 4 |
| 2 · Restaurant manager | `Empty-Search-Equipment.dc.html` | No results · Equipment search | Manager | 4 |
| 3 · Operations manager | `Loading-Ops-Dashboard.dc.html` | Loading · Card feed skeleton (Ops dashboard) | Ops | 0 |
| 3 · Operations manager | `Ops-Dashboard.dc.html` | Ops · Dashboard (open) | Ops | 3 |
| 3 · Operations manager | `Ops-Ticket.dc.html` | Ops · Ticket detail | Ops | 3 |
| 3 · Operations manager | `Ops-Log-Service.dc.html` | Ops · Log service & cost | Ops | 5 |
| 3 · Operations manager | `Ops-Equipment-List.dc.html` | Ops · Equipment list | Ops | 4 |
| 3 · Operations manager | `Ops-Equipment-Details.dc.html` | Ops · Equipment details | Ops | 4 |
| 3 · Operations manager | `Ops-Equipment-Tickets.dc.html` | Ops · Equipment tickets | Ops | 4 |
| 3 · Operations manager | `Ops-Equipment.dc.html` | Ops · Equipment service history | Ops | 4 |
| 3 · Operations manager | `Service-Record.dc.html` | Ops · Service record (invoice) | Ops | 5 |
| 3 · Operations manager | `Ops-Closed.dc.html` | Ops · Closed tab | Ops | 3 |
| 3 · Operations manager | `Ops-Closed-Ticket.dc.html` | Ops · Reopened ticket (start work / close again) | Ops | 3 |
| 3 · Operations manager | `Ops-Contractors.dc.html` | Ops · Contractor directory | Ops | 5 |
| 3 · Operations manager | `Ops-Invoices.dc.html` | Ops · Invoices (search, sort, missing) | Ops | 5 |
| 3 · Operations manager | `Ops-Contractor.dc.html` | Ops · Contractor detail | Ops | 5 |
| 3 · Operations manager | `Empty-Ops-Dashboard.dc.html` | Empty · Ops dashboard (all clear) | Ops | 3 |
| 3 · Operations manager | `Loading-Save.dc.html` | Loading · Inline button spinner (saving service) | Any | 0 |
| 3 · Operations manager | `Ops-Add-Equipment.dc.html` | Ops · Add equipment | Ops | 4 |
| 3 · Operations manager | `Ops-Equipment-QR.dc.html` | Ops · Equipment added + QR label | Ops | 4 |
| 3 · Operations manager | `Empty-Ops-Service.dc.html` | Empty · New equipment, no service yet | Any | 4 |
| 3 · Operations manager | `Ops-Edit-Service.dc.html` | Ops · Edit service record | Ops | 5 |
| 3 · Operations manager | `Empty-Ops-Closed.dc.html` | Empty · Ops closed tab | Ops | 3 |
| 3 · Operations manager | `Empty-Ops-Contractors.dc.html` | Empty · Contractor directory | Any | 5 |
| 3 · Operations manager | `Ops-Add-Contractor.dc.html` | Ops · Add contractor | Ops | 5 |
| 3 · Operations manager | `Ops-Edit-Contractor.dc.html` | Ops · Edit contractor | Ops | 5 |
| 3 · Operations manager | `Ops-Edit-Equipment.dc.html` | Ops · Edit equipment | Ops | 4 |
| 3 · Operations manager | `Import-Equipment-Start.dc.html` | Ops · Import equipment · 1 Choose file | Ops | 7 |
| 3 · Operations manager | `Import-Equipment-Map.dc.html` | Ops · Import equipment · 2 Match columns | Ops | 7 |
| 3 · Operations manager | `Import-Equipment-Review.dc.html` | Ops · Import equipment · 3 Review rows | Ops | 7 |
| 3 · Operations manager | `Import-Equipment-Done.dc.html` | Ops · Import equipment · 4 Done | Ops | 7 |
| 3 · Operations manager | `Empty-Search-Contractors.dc.html` | No results · Contractor search | Any | 5 |
| 3 · Operations manager | `Import-Contractors-Start.dc.html` | Ops · Import contractors · 1 Choose file | Ops | 7 |
| 3 · Operations manager | `Import-Contractors-Map.dc.html` | Ops · Import contractors · 2 Match columns | Ops | 7 |
| 3 · Operations manager | `Import-Contractors-Review.dc.html` | Ops · Import contractors · 3 Review rows | Ops | 7 |
| 3 · Operations manager | `Import-Contractors-Done.dc.html` | Ops · Import contractors · 4 Done | Ops | 7 |
| 4 · Leadership (read-only) | `Loading-Exec-Overview.dc.html` | Loading · Metrics skeleton (Leadership overview) | Leadership | 0 |
| 4 · Leadership (read-only) | `Exec-Overview.dc.html` | Leadership · Read-only overview | Leadership | 7 |
| 4 · Leadership (read-only) | `Exec-Restaurant.dc.html` | Leadership · Restaurant view (read-only) | Leadership | 7 |
| 4 · Leadership (read-only) | `Exec-Ticket.dc.html` | Leadership · Ticket detail (read-only) | Leadership | 7 |
| 4 · Leadership (read-only) | `Exec-Contractors.dc.html` | Leadership · Contractors: directory (read-only) | Leadership | 7 |
| 4 · Leadership (read-only) | `Exec-Invoices.dc.html` | Leadership · Contractors: invoices (read-only) | Leadership | 7 |
| 4 · Leadership (read-only) | `Exec-Service-Record.dc.html` | Leadership · Service record (read-only) | Leadership | 7 |
| 4 · Leadership (read-only) | `Exec-Contractor.dc.html` | Leadership · Contractor detail (read-only) | Leadership | 7 |
| 4 · Leadership (read-only) | `Empty-Exec-Overview.dc.html` | Empty · Leadership overview (no activity) | Leadership | 7 |
| 4 · Leadership (read-only) | `Empty-Exec-Restaurant.dc.html` | Empty · Leadership restaurant (no open tickets) | Leadership | 7 |
| 5 · Account, password & 2-step verification (any role) | `Reset-Request.dc.html` | Password reset · 1 Enter email | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `Reset-Sent.dc.html` | Password reset · 2 Check your email | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `Reset-Email.dc.html` | Password reset · 3 Reset email | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `Reset-New.dc.html` | Password reset · 4 New password | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `Reset-Done.dc.html` | Password reset · 5 Done | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `Profile.dc.html` | Profile · Your account (any role) | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `Help.dc.html` | Profile · Help & support (any role) | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `MFA-Choose.dc.html` | 2-step setup · 1 Choose method | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `MFA-Scan.dc.html` | 2-step setup · 2 Scan with app | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `MFA-Verify.dc.html` | 2-step setup · 3 Enter code | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `MFA-Backup.dc.html` | 2-step setup · 4 Backup codes | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `MFA-Challenge.dc.html` | Sign in · 2-step code | Any | 1 |
| 5 · Account, password & 2-step verification (any role) | `MFA-SMS.dc.html` | 2-step setup · 2 Text message (alt) | Any | 1 |
| 6 · Errors | `Error-404.dc.html` | Error · Page not found (404) | Any | 0 |
| 6 · Errors | `Error-QR-Unknown.dc.html` | Error · QR code not recognized | Manager | 4 |
| 6 · Errors | `Error-No-Access.dc.html` | Error · No access (403) | Any | 0 |
| 6 · Errors | `Error-Expired-Link.dc.html` | Error · Link expired | Any | 1 |
| 6 · Errors | `Error-Session.dc.html` | Error · Signed out (session expired) | Any | 1 |
| 6 · Errors | `Error-Offline.dc.html` | Error · Offline (cached + queued) | Manager | 8 |
| 6 · Errors | `Error-Save-Failed.dc.html` | Error · Validation on save (form kept) | Manager | 2 |
| 6 · Errors | `Error-Server.dc.html` | Error · Something went wrong (500) | Any | 0 |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Home.dc.html` | Walkthrough · Manager: this month | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Checklist.dc.html` | Walkthrough · Manager: checklist (BOH) | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Ticket.dc.html` | Walkthrough · Manager: quick ticket sheet | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Quarterly.dc.html` | Walkthrough · Manager: quarterly task | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Home-Done.dc.html` | Walkthrough · Manager: all done, ready to submit | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Review.dc.html` | Walkthrough · Manager: review & submit | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Review-Partial.dc.html` | Walkthrough · Manager: submit before finished (warning) | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Fix.dc.html` | Walkthrough · Manager: in-house fixes (opened from an item, filtered) | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Edit-Ticket.dc.html` | Walkthrough · Manager: edit / close ticket | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Fix-All.dc.html` | Walkthrough · Manager: in-house fixes (opened from review, all) | Manager | 6a |
| 7 · Monthly walkthrough: Restaurant manager | `WT-Tickets-All.dc.html` | Walkthrough · Manager: all tickets (from review) | Manager | 6a |
| 8 · Monthly walkthrough: Operations manager | `WT-Ops-Overview.dc.html` | Walkthrough · Ops: all restaurants | Ops | 6b |
| 8 · Monthly walkthrough: Operations manager | `WT-Ops-Restaurant.dc.html` | Walkthrough · Ops: one restaurant | Ops | 6b |
| 8 · Monthly walkthrough: Operations manager | `WT-Ops-Schedule.dc.html` | Walkthrough · Ops: schedule | Ops | 6b |
| 8 · Monthly walkthrough: Operations manager | `WT-Ops-Tasks.dc.html` | Walkthrough · Ops: quarterly tasks (all + per restaurant) | Ops | 6b |
| 8 · Monthly walkthrough: Operations manager | `WT-Ops-Fix.dc.html` | Walkthrough · Ops: in-house fixes (read-only, convert to ticket) | Ops | 6b |
| 9 · Monthly walkthrough: Leadership (read-only) | `WT-Exec.dc.html` | Walkthrough · Leadership (read-only) | Leadership | 7 |

## Reading a screen file

- Each file is a self-contained HTML board: a `<helmet>` with the fonts and a `<style>` block, a 390×844 root `<div>`, and a `<script type="text/x-dc">` with a `Component` class whose `renderVals()` returns the values the `{{holes}}` in the markup read. `<sc-for>` repeats, `<sc-if>` shows or hides; neither renders a wrapper element.
- The sample data in each `renderVals()` (restaurant names, ticket ids, costs) is the same data as `supabase/seed.sql`, so a built screen can be compared to its PNG directly.
- `data-props` on the script tag lists the states a board can show (for example `filterSheetOpen`, `mineOnly`); the PNG shows the defaults.
- Links between boards (`href="Ops-Ticket.dc.html"`) are the navigation map; read them as routes.
- `canvas.json` is the board layout: positions, titles, and the section notes.

## Rules for building from these

1. Read the screen file and look at its PNG before writing the component. Match it; do not reinterpret it.
2. Colors, type and radii come from `tokens.md`, never from the hex values inline in a screen file.
3. Where a screen shows a dark text restaurant name with a color square before it, that is the `RestaurantName` component; where it shows a status pill with an icon, that is `StatusPill`. Build the shared component once (`app/src/components`) and use it everywhere the index lists that pattern.
4. The dark theme has no boards. Build each screen from tokens so the dark values in `tokens.md` apply, and check both themes in `/kit`.
