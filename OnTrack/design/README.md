# OnTrack design reference

The design for OnTrack, exported from the Claude Design canvas on 2026-10-28. Drop this folder into the repo root as `design/`. It is the source of truth for how every screen looks; agents and people build from it, not from memory of the canvas.

```
design/
  README.md        this file
  INDEX.md         every screen: file, title, role, build phase
  tokens.md        colors, type, radii, restaurant colors, proposed dark theme
  canvas.json      board positions and section titles from the canvas
  screens/
    <Name>.dc.html the screen's markup, CSS and sample data
    <Name>.png     the screen rendered at 390×844, light mode, 2x
```

## How to use it

- **Building a screen:** open `INDEX.md`, find the screen, read its `.dc.html` and look at its `.png`. The HTML has the exact spacing, copy and sample data; the PNG is what it should look like. Match it.
- **Finding what a phase needs:** filter `INDEX.md` by the Phase column. The build plan's phase sections list the same screens by title.
- **Styling:** everything comes from `tokens.md`. Never copy a hex value out of a screen file into app code.
- **Navigation:** the `href` values between screen files are the routes. A screen that links to `Ops-Ticket.dc.html` navigates to the ticket detail.
- **States:** each screen's `data-props` lists the alternate states it can show (sheet open, empty, mine only). The PNG shows the defaults; render the HTML with the other props when you need the other state.

## Rule for the repo's CLAUDE.md

Paste this into the repo's `CLAUDE.md` so every agent session follows it:

```
## Design
The design lives in design/. Before building or changing any screen, read its
file in design/screens/<Name>.dc.html and look at design/screens/<Name>.png.
Match it; do not reinterpret it. Styles come only from design/tokens.md.
A phase is done when every screen listed for it in design/INDEX.md renders
on a phone and matches its PNG, in light and dark mode.
```

## Rendering a screen locally

The `.dc.html` files use a small runtime (`support.js`) that was part of the canvas, not included here. To look at a screen, the PNG is enough. If a new state needs rendering, ask for a fresh export rather than trying to run the files.

## Updating

When the canvas changes, re-export the whole folder; do not hand-edit screen files here. The commit message should say which screens changed so the agent working that phase knows to re-read them.
