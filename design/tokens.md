# OnTrack design tokens

Pulled from the screen files in `screens/`. These are the source for `app/tailwind.config.ts` and the CSS variables in `app/src/styles/tokens.css`. Light values are what the canvas shows; dark values are proposed and have no boards yet, so check them in `/kit` and adjust before building screens on them.

## Type

| Token | Value | Used for |
| --- | --- | --- |
| `font-display` | `Archivo`, weights 500, 600, 700 | H1 (30px), screen titles (24px), sheet titles (22px), KPI numbers, avatar initials |
| `font-body` | `Public Sans`, weights 400, 500, 600, 700 | Everything else; inputs must be 16px or larger on iOS |
| `font-mono` | `JetBrains Mono`, weight 500 | Ticket ids (OT-1042), serial numbers, money |

Scale: 11, 12, 13, 14, 15, 16, 20, 22, 24, 30 px. Eyebrows are 11 or 12px, weight 700, letter-spacing 0.06em, uppercase. H1 letter-spacing is -0.02em.

## Color, light theme

| Token | Hex | Used for |
| --- | --- | --- |
| `bg` | `#F3F4F1` | Screen background |
| `surface` | `#FFFFFF` | Cards, inputs, sheets, nav bar |
| `surface-sunken` | `#E5E8E3` | Segmented control track, chips, count badges |
| `surface-muted` | `#ECEEEB` | Readonly inputs, closed pills, role tags |
| `surface-hover` | `#F7F8F6` | Row hover |
| `border` | `#DDE1DC` | Card and row borders, dividers |
| `border-strong` | `#C9CFCA` | Input borders, secondary buttons |
| `border-muted` | `#A9B3AE` | Dashed outlines, hover borders |
| `text` | `#15201B` | Primary text |
| `text-body` | `#2E3833` | Body copy, labels |
| `text-secondary` | `#4D5752` | Eyebrows, helper text |
| `text-muted` | `#5A645F` | Meta lines, placeholders |
| `text-faint` | `#3F4944` | Readonly input text |
| `brand` | `#12634F` | Primary buttons, active tab, links, switches on |
| `brand-strong` | `#0B4537` | Link hover, dark panels, cover backgrounds |
| `brand-tint` | `#DCE8E3` | Avatar backgrounds, selected count badge |
| `brand-tint-soft` | `#E3EFEA` | Info banners, selected rows |
| `urgent` | `#B4400C` | URGENT tag background (white text) |
| `danger` | `#94390A` | Destructive text, expired, delete buttons `#A33A0B` |
| `info` | `#1B4F91` | In progress, converted-to-ticket, Ops messages |

## Status pills

| Status | Background | Text | Icon |
| --- | --- | --- | --- |
| Open, Unassigned | `#FBEADF` | `#94390A` | hollow circle |
| In progress | `#E4EDF8` | `#1B4F91` | pie (Carbon in-progress) |
| Waiting on parts | `#F3ECD6` | `#6A500C` | clock |
| Scheduled | `#E4EDF8` | `#1B4F91` | calendar with check |
| Reopened | `#F3ECD6` | `#6A500C` | circle arrow |
| Closed | `#ECEEEB` | `#3F4944` | circle with check |
| Fixed (in-house) | `#DCE8E3` | `#0B4537` | circle with check |

The Reopened banner on tickets uses `#FBF5E3` background, `#E2C77A` border, `#4A3808` text. Walkthrough tags are a white outline chip: border `#A9B3AE`, text `#2E3833`, clipboard icon. The walkthrough's progress bar (WT-Home) is brand fill for Good, `#C9A227` for in-house and the URGENT orange for tickets, on the `surface-sunken` track.

## Restaurant colors

Each restaurant has one accent, shown as a 9 to 14px rounded square with an inset outline `rgba(21,32,27,.18)` before the name. The name itself is always `text-body`, never colored.

| Restaurant | Hex |
| --- | --- |
| Federale’s Logan Square | `#A3336D` |
| Federale’s West Loop | `#6B3FA0` |
| Ranalli’s Logan Square | `#1B4F91` |
| Porter | `#9A6A00` |

Presets offered for new restaurants: Ocean `#0E7490`, Brick `#9B2C2C`, Walnut `#7A4F2A`, Olive `#5C6B1F`, Slate `#475569`, Plum `#6E2F4F`, Charcoal `#333B3F`, plus a custom hex. "All restaurants" is a 2×2 grid of the four colors.

## Shape and spacing

| Token | Value |
| --- | --- |
| `radius-card` | 14px (cards), 12px (inputs, buttons, sheets' inner cards) |
| `radius-control` | 10px (small buttons), 9px (segmented control) |
| `radius-pill` | 999px |
| `radius-square` | 3px (restaurant square), 6px (tags) |
| `radius-sheet` | 22px top corners |
| Tap target | 44px minimum; primary button 52px; secondary 48px |
| Screen padding | 20px sides; 12 to 16px between cards |
| Phone frame | 390 × 844, bottom nav 6px 8px 20px with the home-bar safe area added on device |

## Dark theme, proposed

Keep the brand green and the restaurant colors; invert the neutrals and lift the surfaces one step. Pill backgrounds become 20% tints of their text colors on the dark surface.

| Token | Dark |
| --- | --- |
| `bg` | `#121716` |
| `surface` | `#1B2220` |
| `surface-sunken` | `#232B29` |
| `surface-muted` | `#2A3331` |
| `border` | `#2E3835` |
| `border-strong` | `#3C4744` |
| `text` | `#EEF1EE` |
| `text-body` | `#D6DCD8` |
| `text-secondary` | `#A8B2AD` |
| `text-muted` | `#8A948F` |
| `brand` | `#3EA583` (buttons stay readable with dark text, or keep `#12634F` fill with white text and use `#3EA583` for links) |
| `brand-tint` | `#1E3A32` |
| `urgent` | `#D9542A` |

Decide the button treatment in `/kit` before any screen uses it; the rest follows from the variables.
