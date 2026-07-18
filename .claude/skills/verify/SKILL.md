---
name: verify
description: Build and drive the PAGODA game end to end in headless Chromium to verify changes at the real surface.
---

# Verify PAGODA (in traffic-lights/)

## Build & test

```bash
cd traffic-lights
npm install            # only esbuild
npm test               # pure-core unit tests (node --test)
npm run build          # -> dist/pagoda.html (single self-contained file)
```

## Drive the real app

The built file works over `file://` (no server needed). Use playwright-core
with the preinstalled Chromium:

```js
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto('file:///ABSOLUTE/PATH/traffic-lights/dist/pagoda.html');
```

(If `chromium-1194` is missing, `find /opt/pw-browsers -maxdepth 3 -name chrome`.)

## Flows worth driving

- Setup screen: mode segments (`.seg button`: "Solo", "Two Builders",
  "Daily Puzzle"), variants, start via `button.btn-primary` ("Begin").
- All copy is English-only (PAGODA theme). Theme toggle is the first
  `.topbar .icon-btn` (Auto → Dusk → Dawn).
- Board cells: `.cell[data-row][data-col]` — clicking a cell with no stack
  selected plays the cell's forced next stage (shrine → story → spire);
  clicking a `.stack[data-color]` first selects and highlights `.cell.legal`.
  Stages render as stacked pagoda stories (`.piece.green/.yellow/.red`).
- Two Builders quick win for P1: shrines at (0,0),(2,0),(0,1),(2,1),(0,2)
  → win line, overlay after ~1.5 s (`.overlay h2`).
- vs AI: after a human move the status shows "The Spirit contemplates…";
  AI replies after ~500 ms (Enlightened can take ~1.5 s).
- Analysis: overlay button "Recall the game" → `.analysis-box` (async,
  can take a few seconds).
- Blitz: `.blitz-timer` counts down from 10 s; timeout plays an automatic
  move.
- Puzzle mode: board pre-filled from a date-seeded position; deterministic
  per day. AI opponent is "The Spirit".

## Gotchas

- Game state (settings, profile) persists in localStorage — a fresh browser
  context = clean profile.
- `page.on('pageerror')` + console errors should stay empty; the game logs
  nothing in normal play.
- Internal stage names are still green/yellow/red in code and CSS classes;
  only user-facing copy uses shrine/story/spire.
