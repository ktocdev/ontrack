OnTrack is a phone-first app for equipment and repair tickets across a restaurant group. Managers file a problem from the floor in under a minute; the Support Team works it from a dashboard; leadership reads the totals. Design for a person standing in a kitchen with one hand free: big targets, short words, nothing that needs explaining.

## Content

- **Plain words, sentence case.** Buttons, titles and menu items in sentence case: "Create ticket", "Close ticket", "View closed tickets". Never title case, never all caps except the eyebrow and tag styles.
- **Say "you".** "You'll get a notification when work starts." The app never says "I" or "we".
- **A button is the action it takes.** "Save changes", "Reopen ticket", "Invite people", not "OK" or "Submit". While it works, say so: "Saving…", "Updating…".
- **Say what happened and what happens next.** "Reopened and sent to Ops. You'll get a notification when work starts."
- **Never blame the person.** "Couldn't save yet. Everything you entered is still here." not "Invalid input".
- **Name people, not roles.** "Bert Velilla is on it", not "Assigned". A person's job title comes before their role name.
- **Numbers lead.** Ticket numbers (`OT-1042`), money and serial numbers are set in mono so people can read them out and type them.
- **No emoji, no exclamation marks.** Calm, factual, short.
- **The group is data.** A restaurant group's name, its restaurants, their colors and the role names ("Reporters", "Support Team") come from the database. Never write a group or restaurant name into a component.

## Color

Neutrals are a cool green-grey; the one brand hue is a deep green. Every value is a token; never paste a hex.

- **Surfaces.** `bg` is the screen; `surface` is every card, input, sheet and bar on it. `surface-sunken` is a track or chip pressed into a surface, `surface-muted` a read-only field or closed pill, `surface-hover` a hovered row.
- **Text.** `text` for titles, `text-body` for body copy, `text-secondary` for eyebrows and helper text, `text-muted` for meta lines and ticket numbers. All read at 4.5:1 or better on `bg` and `surface` in both themes.
- **Borders.** `border` around cards and between rows, `border-strong` around inputs and secondary buttons, `border-muted` for dashed outlines.
- **Brand.** `brand` for links, the active tab and a switch that is on. `brand-fill` with `on-brand` text for primary buttons; `brand-fill-hover` and `brand-fill-active` for its states. `brand-tint` and its softer steps for selected rows, info banners and your own message in a thread.
- **Meaning.** `urgent` is the URGENT tag (white text); `danger` and `danger-fill` are destructive text and buttons; `info` is in progress and Ops' messages. Status pills take their pair from `status-{open,progress,waiting,scheduled,reopened,closed,fixed}-{bg,text}`, and each pill carries an icon too, so status never relies on color alone.
- **Walkthroughs** have their own families: `progress-*` for the bar and rings, `choice-*` for the checklist's picked buttons, `standing-*` for the months, `rotation-*` for a schedule's months.
- **Restaurants.** Each restaurant has one accent, stored with the restaurant. It appears only as a small square before the name (`RestaurantName`) and as the tint of its panel on the dashboard (`RestaurantGroup`); the name stays `text-body`. The `restaurant-*` tokens are the seed's samples and the `preset-*` tokens the choices on Add restaurant.
- **Dark.** A full dark theme keeps the brand green for primary buttons and lifts `brand` for links. Pill backgrounds become 20% tints of their text color on the dark surface. White text on `urgent` falls to 4.0:1 in dark; it is kept as the app has it (the tag is 11px bold).

## Type

- **Archivo** (`display`) for titles and figures: `type-h1` 30px for a home greeting, `type-screen-title` 24px for a screen header, `type-sheet-title` 22px, `type-bar-title` 20px. Bold, tightened slightly.
- **Public Sans** (`body`) for everything else: `type-body` 16px, `type-card-title`, `type-button` 15px bold, `type-label` 14px semibold, `type-meta` 13px in `text-muted`, `type-eyebrow` 12px bold uppercase with 0.06em tracking.
- **JetBrains Mono** (`mono`) for ticket numbers (`type-id`), money and serials (`type-money`).
- Every input, select and textarea is 16px, always: iOS zooms the page on a smaller field.

## Shape, space and elevation

- **Radii are named by what they round:** `radius-card` 14 for cards, `radius-input` 12 for inputs, buttons and a sheet's inner cards, `radius-control` 10 for small buttons, `radius-segment` 9 and `radius-track` 11 for the segmented control, `radius-tag` 6, `radius-chip` 5 for URGENT and Walkthrough tags, `radius-square` 3 for a restaurant square, `radius-sheet` 22 for a sheet's top corners, `radius-pill` for pills and avatars.
- **Borders, not shadows.** A card is `surface` with a 1px `border`, never a shadow. Shadows are only for what floats: `shadow-raised` for the toast and update bar, `shadow-dialog` for a centered dialog, `shadow-segment` and `shadow-knob` for the selected segment and the switch knob. `scrim` dims the screen behind a sheet.
- **Phone rules.** Screen padding `screen-pad` (20px) on the sides, 12 to 16px between cards. Tap targets at least `tap-min` (44px); primary buttons `btn-primary-h` (52px), secondary `btn-secondary-h` (48px). Full-height layouts use `100dvh`; fixed bars pad themselves with the safe-area insets.
- **Larger screens.** Below 768px the phone layout never changes. From 768px a `Sidebar` (`sidebar-w`) replaces the tab bar and one-column screens sit in `reading-max` (720px); a form opened from a list is a `form-max` panel; sheets become centered dialogs. From 1024px a list opens its item beside it in a `list-pane` column. Past `desktop-max` (1440px) the frame centers.

## States and motion

- Hover lifts a row to `surface-hover` or a card's border to `border-strong`; press sinks it to `surface-muted`. Disabled controls keep their shape and drop their contrast.
- Focus is a solid 2px `brand` outline, 2px out, on every focusable element.
- A ticket made in the last five minutes carries a ring on its card.
- Motion is short and functional: a sheet rises 24px and fades in, a toast fades in. Loading is a skeleton in the shape of what is coming, with a shimmer that stops for reduced motion.

## Iconography

OnTrack draws its own 24px line icons as React components (`OnTrack.IconTicket`, `OnTrack.IconWrench`, …): 2px rounded strokes in `currentColor`, sized with `size`. The full set is on the Icons card. The mark is a white check in a `brand-fill` rounded square (`OnTrack.Logo`; `OnTrack.BrandMark` adds the name; the files are in the Logos assets). Status icons belong to their pill. Never use emoji or a second icon set.

## Building with the components

Components are the app's own, from `window.OnTrack`, styled by the app's compiled stylesheet over these tokens, on React 19.

- Wrap whatever you render in `OnTrack.Frame`: it gives the router, toasts and theme every app screen has.
- Theme follows `data-theme="light|dark"` on `<html>`.
- Lay a screen out as the app does: `Screen` › `ScreenHeader` (home) or `BackBar` / `CloseBar` (detail) › `ScreenBody`, with `TabBar` on a phone home screen.
- Shared patterns are shared components: a restaurant is `RestaurantName`, a status is `StatusPill`, a ticket is `TicketCard` or `OpsTicketCard`, a figure is `Kpi`. Use them rather than rebuilding them.
- The interface hides what a person may not do, but never invents a rule: costs show only where the person may see costs, and a read-only view simply has no controls.
