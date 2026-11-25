// components/<Card>/README.md: a summary, when to use it, what the consumer provides (each export with
// its own doc comment from the source), and the docs site's do and don't.
//   node artifact-export/readmes.mjs <out>/project
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HERE = import.meta.dirname
const OUT = resolve(process.argv[2])
const cards = JSON.parse(readFileSync(resolve(HERE, '.tmp/cards.json'), 'utf8'))
const dts = (f) => readFileSync(resolve(HERE, '.tmp/dts/components', `${f}.d.ts`), 'utf8')

/** [file, summary, when to use, do, don't] */
const C = {
  Button: [
    'Button',
    "The app's buttons: one primary action per screen, full width at the bottom on a phone, plus icon buttons.",
    'Primary 52px, secondary 48px, nothing tappable under 44px. `ButtonLink` looks the same and navigates; `IconButton` is a 44px square with a required `label`.',
    [
      'Write the label as the action: Create ticket, Save changes, Close ticket.',
      'Say what is happening while it works: Saving…, Updating….',
      'Put a destructive action behind a sheet that says what happens.',
    ],
    [
      'Put two primary buttons on one screen.',
      'Shrink a button below 44px to fit a row.',
      'Use danger for anything you can undo.',
    ],
  ],
  StatusPill: [
    'Pill',
    'A ticket status as a pill with an icon, so it reads without color; tags mark what a ticket is and badges count.',
    'Wherever a status shows. `UrgentTag` for an urgent ticket only, `WalkthroughTag` for one from a walkthrough, `RoleTag` for a role or job title, `CountBadge` and `TabAlert` for counts.',
    [
      'Use the status pill wherever a status is shown, so its icon and color always agree.',
      'Give a TabAlert a label that says what the number counts.',
    ],
    [
      'Make a new pill color for a new state: add a status token pair first.',
      'Use UrgentTag for anything but an urgent ticket.',
    ],
  ],
  RestaurantName: [
    'RestaurantName',
    'A restaurant is always its name with its color square; only the square carries the accent.',
    'Every place a restaurant is named. The color is data from the database, passed in as `color`.',
    [
      "Pass the restaurant's own color; the name stays `text-body`.",
      'Use `AllRestaurantsSquare` for "All restaurants".',
    ],
    ['Color the name itself.', 'Write a restaurant or group name in code.'],
  ],
  RestaurantPicker: [
    'RestaurantPicker',
    "Scopes a screen to one restaurant or all of them, as a row, a chip, or the screen's title.",
    "Every Ops screen's restaurant scope; `RestaurantTitlePicker` where the restaurant is the title (leadership).",
    ['Offer All restaurants first when the person sees more than one.'],
    ['Show a picker to someone scoped to one restaurant.'],
  ],
  AccentPicker: [
    'AccentPicker',
    "Picks a restaurant's accent: the `preset-*` colors, then a hue wheel for a custom hex.",
    'Add and Edit restaurant only.',
    ['Warn when a custom hex is not six digits.'],
    ["Offer accents anywhere but a restaurant's settings."],
  ],
  ReorderList: [
    'ReorderList',
    'Drag, or use the keyboard, to set an order: restaurants with their color, or checklist parts with a line under each.',
    "Custom order on the dashboard's Sort sheet, and the checklist editor.",
    ['Give it a `label` that names what is being ordered.'],
    ['Use it for fewer than three items.'],
  ],
  Avatar: [
    'Avatar',
    "Initials on a color from the person's role, or from the invite's state on pending and expired rows; a photo replaces the initials when the group allows photos.",
    "28 and 30 in threads, 38 and 40 in lists, 52 on a person's page, 88 on Profile.",
    ['Pass the role so the color matches everywhere.'],
    ['Pick an avatar color by hand.'],
  ],
  ListCard: [
    'Card',
    'A card is `surface` on `bg` with a 1px `border` and the 14px `radius-card`, no shadow; lists are rows inside one card, divided by borders.',
    'Lists of people, settings and items (`ListCard` with `ListRow*`), details (`KeyValueRow`, `StackedRow`), category tiles, and a list its heading shows and hides (`DisclosureList`).',
    ['Leave 12 to 16px between cards.', 'Make a whole row the tap target when it opens something.'],
    ['Put a shadow on a card; elevation is for what floats over the screen.', 'Nest a card inside a card.'],
  ],
  Field: [
    'Field',
    'Every field has a visible label above it and its text at 16px, so iOS never zooms; hints sit under it, and an error replaces the hint.',
    'Text, textarea, select, search and password fields. `PasswordRules` ticks as someone types.',
    ['Label every field; a placeholder is an example, not a label.', 'Keep what someone typed when saving fails.'],
    ['Set a field below 16px.', 'Clear a form on an error.'],
  ],
  CodeInput: [
    'CodeInput',
    "2-step verification and backup codes, with the setup's step bars.",
    'The 2-step setup and sign-in screens.',
    ['Say what to do when a code fails.'],
    ['Use it for anything but a one-time code.'],
  ],
  CostCard: [
    'Cost',
    "Log service's amounts: a field per amount on the right, the total under a divider; an amount that will not read is marked and the total shows a dash.",
    'Log service and Edit service record.',
    ['Show the total live as amounts change.'],
    ['Show costs to someone without `see_costs`.'],
  ],
  Segmented: [
    'Segmented',
    'Switches a view between two to four options on a sunken track.',
    'Front / Back / IT areas, Light / Dark / System. `size="sm"` is the 36px track.',
    ['Show a count in a segment when it helps choose.'],
    ['Use a segmented control for more than four options.'],
  ],
  Chip: [
    'Chip',
    'Chips pick and filter: one choice of a few, a filter that can be removed, and the filter button with its count.',
    '`ChoiceChips` for a short single choice (Urgency), `Chip` for filters, `FilterButton` and `FilterChip` on lists.',
    ['Put the count in the chip when it helps.'],
    ['Use chips for navigation.'],
  ],
  RadioCard: [
    'RadioCard',
    'Chooses one option with an explanation under its title.',
    'Role on Invite user; anywhere a choice needs a sentence to explain it. Wrap the cards in a `role="radiogroup"` with a label.',
    ['Say in the subtitle what the choice means.'],
    ['Use it where a plain list of words would do.'],
  ],
  Switch: [
    'Switch',
    'Turns a setting on or off at once; rows pair it with a title, and a list row also opens finer choices.',
    "Profile and settings screens. `SwitchListRow` is My categories' row: the text opens a sheet, the switch turns it all on or off.",
    ['Use a switch only when the change applies at once.'],
    ['Use a switch inside a form that has a Save button.'],
  ],
  ViewSettingFields: [
    'ViewSetting',
    'Notify me and Show on my lists, for an area or a category.',
    "My categories' sheet. `viewSummary` writes the line under a row.",
    ['Show the summary line beside the row it describes.'],
    ['Rebuild these choices elsewhere.'],
  ],
  ThemeControl: [
    'ThemeControl',
    "Light, dark or the phone's setting, saved on the device.",
    'Profile only. Outside the app, wrap it in `Frame`, which supplies the theme.',
    ['Leave System as the default.'],
    ['Add a second theme switch.'],
  ],
  ScreenHeader: [
    'Screen',
    'Every screen is built from `Screen`, `ScreenHeader` and `ScreenBody`; detail screens get a back, title or close bar instead of the tab bar.',
    'Home screens use `ScreenHeader`; detail screens `BackBar`, `TitleBar` or `CloseBar`; a cover uses `BrandBackBar`. `UnderlineTabs` switch lists; `SectionLabel` heads a group.',
    ["Put the less common actions in the header's ellipsis menu."],
    ['Put a tab bar on a detail screen.'],
  ],
  TabBar: [
    'TabBar',
    'One bottom tab bar per role; its bottom padding is the home-bar inset, at least 8px.',
    "The role's home screens on a phone, below 768px. `ROLE_TABS` holds each role's tabs.",
    ['Pad the bottom with the safe-area inset.'],
    ['Add a fifth tab.'],
  ],
  Sidebar: [
    'Sidebar',
    "From 768px the sidebar takes the tab bar's place, on detail screens too: the mark and group name, the role's tabs, the Admin row, and who is signed in at the foot.",
    'Laptop and tablet frames.',
    ["Show the group's name from data."],
    ['Show the sidebar under 768px.'],
  ],
  AdminShield: [
    'AdminShield',
    'Left of the avatar on a home screen, for someone who holds Admin on top of their role: outlined it opens the admin view, filled it leads back home.',
    'Home screen headers only.',
    ['Fill it while in the admin view.'],
    ['Show it on detail screens.'],
  ],
  Notice: [
    'Notice',
    'Notices stay on a screen: success, info, waiting and warning tones, and the error banner that says nothing was lost.',
    'Above a form or list. `ErrorBanner` when saving fails.',
    ['Say what happened and what happens next.'],
    ['Blame the person: say "Couldn\'t save yet", not "You entered an invalid value".'],
  ],
  Toast: [
    'Toast',
    'A dark bar that confirms and leaves: one at a time, 4 seconds, announced to screen readers, with an optional action.',
    'After an action succeeds. Call `useToast().show(message, action?)` inside `ToastProvider` (or `Frame`).',
    ['Offer Undo on a toast rather than asking first, where undo is possible.'],
    ['Use a toast for something they must act on.'],
  ],
  EmptyState: [
    'EmptyState',
    'Says what belongs here and how to add it, with an icon and an action.',
    'An empty list or no search results (`tone="neutral"`).',
    ['Give the one action that fills the screen.'],
    ['Leave a list blank.'],
  ],
  UpdateBar: [
    'UpdateBar',
    'Offers the new version of the app when one is ready.',
    'Once, above the tab bar, when the service worker has an update.',
    ['Say Updating… while it reloads.'],
    ['Show it while nothing is waiting.'],
  ],
  HiddenCategories: [
    'HiddenCategories',
    'The line under a list that says how many categories the person hides, with Show all.',
    'Every list of tickets that follows My categories.',
    ['Keep Show all until they leave the screen.'],
    ['Hide a ticket the person filed or is on.'],
  ],
  Sheet: [
    'Sheet',
    'A sheet rises from the bottom for a decision or a short form; on a computer it becomes a centered dialog. Swipe down closes it from the top of its scroll.',
    'Confirming, choosing, short forms. `ConfirmSheet` for a yes or no.',
    [
      'Put the primary action first in a sheet, Cancel second.',
      'Say in the description what the action does to other people.',
    ],
    ['Stack a sheet on a sheet.', 'Let a modal sheet close by a swipe.'],
  ],
  InstallSheet: [
    'InstallSheet',
    "Asks once to install the app: Android's Install button, or iPhone's two steps.",
    'Once after sign-in, and from Profile.',
    ['Ask once.'],
    ['Ask on every visit.'],
  ],
  OverflowMenu: [
    'Menu',
    'The ellipsis menu for less common actions, and the ready-made menus for a ticket, a unit and a contractor.',
    "Beside a screen's title. `TicketMenu`, `EquipmentMenu`, `ContractorMenu` add Share link.",
    ['Keep the menu short.'],
    ["Hide the screen's main action in a menu."],
  ],
  StatusMenu: [
    'StatusMenu',
    "Ops' status dropdown on a ticket: the statuses, then actions such as Take this over and Close ticket.",
    "An Ops ticket's header.",
    ['Show the current status as the button.'],
    ['Offer a status the person may not set.'],
  ],
  TicketCard: [
    'TicketCard',
    "A manager's ticket card: number in mono, title, status, where the problem is and who is on it; a ticket made in the last five minutes carries a ring.",
    "A Reporter's lists, and leadership's restaurant (without who and when).",
    [
      'Lead with the ticket number in mono; people read it out and type it.',
      'Name who is on a ticket rather than "assigned".',
    ],
    ['Add a separate reopened screen; a reopened ticket is an ordinary card with its pill.'],
  ],
  OpsTicketCard: [
    'OpsTicketCard',
    "A denser ticket card for Ops, grouped under each restaurant; across restaurants the restaurant takes the number's place.",
    'The Ops dashboard, inside `RestaurantGroup`; Admin tickets.',
    ['Show the URGENT tag first.'],
    ['Show a cost to someone without `see_costs`.'],
  ],
  RestaurantGroup: [
    'RestaurantGroup',
    "A restaurant's row on the dashboard, with its open and urgent counts, in one panel tinted with the restaurant's own color; closed, it still shows its urgent tickets.",
    "The Ops dashboard and leadership's Open and Urgent lists. The tint mixes the restaurant's color into the page by `--restaurant-panel-mix` (stronger in dark).",
    ['Pass urgent tickets as `pinned` so they show while closed.'],
    ['Add a hex for a restaurant; its color is data.'],
  ],
  ClosedTicketRow: [
    'ClosedTicketRow',
    "Closed tickets grouped by month, with the month's total.",
    'Closed tickets lists. The total shows only with `see_costs`.',
    ['Group by the month it closed.'],
    ['Show a total without `see_costs`.'],
  ],
  ThreadMessage: [
    'Thread',
    "A ticket's thread mixes system events and messages; your own sit in a brand tint, and Ops can mark a note internal, which Reporters never see.",
    'Ticket detail. `Composer` writes; `VisibilityToggle` marks a note internal (Ops only).',
    ['Say who and when on every message.'],
    ['Show an internal note to someone who may not read it.'],
  ],
  PhotoThumb: [
    'Photo',
    'Photo thumbnails, the viewer, the tray of photos being added, and the add-photo buttons.',
    'Messages, the ticket form, the composer. Photos are resized to 1600px before upload.',
    ['Ask before a ticket is sent without a photo.'],
    ['Upload full-size photos.'],
  ],
  EquipmentGroup: [
    'Equipment',
    'Equipment lists fold by category, with open tickets badged on the group and the row.',
    'Both equipment lists. Spend shows only with `see_costs`.',
    ["Start every group closed on a manager's list."],
    ['Show retired units in the main list.'],
  ],
  TaskRow: [
    'TaskRow',
    'In-house tasks check off in place and can be deleted only while open; Ops sees fixes read-only with Convert to ticket.',
    "A Reporter's In-house list (`TaskRow`), Ops' in-house fixes (`FixRow`).",
    ['Show where a task came from.'],
    ['Offer Delete on a task once checked off.'],
  ],
  ContractorCard: [
    'ContractorCard',
    "A contractor in the directory: this year's spend, a tag per trade, a Preferred star, an insurance warning within 30 days of running out, and a call button.",
    'The contractor directory. Spend and visits show only with `see_costs`.',
    ['Show the call button only when there is a phone.'],
    ['Show spend without `see_costs`.'],
  ],
  Kpi: [
    'Kpi',
    'A figure and what it counts, in a two-up grid; urgent colors a count that needs attention and muted is for nothing yet.',
    "Leadership's Overview, a contractor's page. With `to`, the tile opens what it counts.",
    ['Two to a row; `wide` spans both.'],
    ['Use the urgent tone for anything that is not urgent.'],
  ],
  MonthStepper: [
    'MonthStepper',
    'Moves a screen a month at a time; a month with no neighbour disables its button.',
    "Leadership's Overview and Spend, Ops' walkthroughs overview.",
    ["Put the month's one-line summary under it."],
    ['Step past the months that have data.'],
  ],
  ReadOnlyBanner: [
    'ReadOnlyBanner',
    "A band that says a screen is view only, taking the phone's top inset.",
    "The admin's ticket screen only.",
    ['Draw the header under it with `underBanner`.'],
    ["Put it on leadership's screens; they file and post."],
  ],
  ProgressBar: [
    'Walkthrough',
    "A month's walkthrough at a glance: a bar split by how each done item ended (Good, in-house, ticket), a ring per section, flags, standings and history.",
    "Walkthrough home, Review & submit, and Ops' and leadership's overviews.",
    ['Count each done item once: a ticket first, then an in-house fix, then Good.'],
    ["Pick the bar's colors by hand; they are the `progress-*` tokens."],
  ],
  ChecklistGroup: [
    'Checklist',
    'A walkthrough checklist: group cards that open and close, Good / In-house / Ticket on each item (lit once picked), and what was made from an item listed under it.',
    "The walkthrough's checklist and quarterly tasks.",
    ['Leave Good out while an item has a fix or ticket still open.'],
    ['Allow Good on an item with something open under it.'],
  ],
  RotationMonthRow: [
    'Schedule',
    "The walkthrough schedule's pieces: whose schedule it is, a rotation's months, the year's preview and quarterly tasks.",
    "Ops' Schedule and Quarterly tasks screens. Months go A, B, C, then round, from `rotation-1` to `rotation-3`.",
    ['Leave Edit out without `set_walkthrough_schedule`.'],
    ['Copy a rotation per restaurant; several share one.'],
  ],
  Skeleton: [
    'Skeleton',
    'A skeleton in the shape of what is coming, so nothing jumps when it arrives; a spinner only where there is no shape, and inside a button while it works.',
    'Every screen while its data loads. Shimmer stops for reduced motion.',
    ['Match the skeleton to the layout that will arrive.'],
    ['Show a full-screen spinner where a skeleton fits.'],
  ],
  Icons: [
    'icons',
    "The app's own icon set: 24px line icons drawn as React components that take `size` and inherit `currentColor`, plus the OnTrack mark (`Logo`, `BrandMark`).",
    'Everywhere an icon shows. Icons beside text are decorative; an icon on its own sits in an `IconButton` with a label.',
    ["Color an icon through its parent's text color."],
    ['Use emoji or another icon set.'],
  ],
}

function exportsOf(text) {
  const out = []
  const re = /(\/\*\*([\s\S]*?)\*\/\s*)?export (?:declare )?(function|const|type) (\w+)/g
  let m
  while ((m = re.exec(text))) {
    const doc = m[2]
      ? m[2]
          .split('\n')
          .map((l) => l.replace(/^\s*\* ?/, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      : ''
    out.push({ kind: m[3], name: m[4], doc })
  }
  return out
}

for (const c of cards) {
  const [file, summary, when, dos, donts] = C[c.name]
  const ex = exportsOf(dts(file))
  const comps = ex.filter((e) => e.kind !== 'type' && /^[A-Z]/.test(e.name))
  const helpers = ex.filter((e) => e.kind !== 'type' && /^[a-z]/.test(e.name))
  const types = ex.filter((e) => e.kind === 'type')
  let md = `# ${c.name}\n\n${summary}\n\n## When to use it\n\n${when}\n\n`
  md += `## What you provide\n\nFrom \`window.OnTrack\` (source: \`app/src/components/${file}.tsx\`; props in \`${c.name}.d.ts\`). Render inside \`OnTrack.Frame\`, which gives the router, toasts and theme the app gives every screen.\n\n`
  if (c.name === 'Icons') {
    md += `${comps.length} exports. Each takes \`size\` (default 24) and draws in \`currentColor\`: ${comps.map((e) => `\`${e.name}\``).join(', ')}.\n\n`
  } else {
    for (const e of comps) md += `- \`${e.name}\`${e.doc ? `: ${e.doc}` : ''}\n`
    if (helpers.length)
      md += `\nHelpers: ${helpers.map((e) => `\`${e.name}\`${e.doc ? ` (${e.doc.replace(/\.$/, '')})` : ''}`).join('; ')}.\n`
    if (types.length) md += `\nTypes: ${types.map((e) => `\`${e.name}\``).join(', ')}.\n`
    md += '\n'
  }
  md += `## Do\n\n${dos.map((d) => `- ${d}`).join('\n')}\n\n## Don't\n\n${donts.map((d) => `- ${d}`).join('\n')}\n`
  writeFileSync(resolve(OUT, 'components', c.name, 'README.md'), md)
}
console.log('wrote', cards.length, 'READMEs')
