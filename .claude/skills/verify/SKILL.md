---
name: verify
description: Build and drive the Traffic Lights game end to end in headless Chromium to verify changes at the real surface.
---

# Verify Traffic Lights

## Build & test

```bash
cd traffic-lights
npm install            # only esbuild
npm test               # pure-core unit tests (node --test)
npm run build          # -> dist/traffic-lights.html (single self-contained file)
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
await page.goto('file:///ABSOLUTE/PATH/traffic-lights/dist/traffic-lights.html');
```

(If `chromium-1194` is missing, `find /opt/pw-browsers -maxdepth 3 -name chrome`.)

## Flows worth driving

- Setup screen: mode segments (`.seg button`), variants, start via
  `button.btn-primary`.
- Default language follows `navigator.language` (Chromium = EN). Toggle with
  the first `.topbar button` for deterministic PT assertions.
- Board cells: `.cell[data-row][data-col]` — clicking a cell with no stack
  selected plays the cell's forced next color; clicking a `.stack[data-color]`
  first selects and highlights `.cell.legal`.
- 1v1 quick win for P1: green at (0,0),(2,0),(0,1),(2,2),(0,2) → win line,
  overlay after ~1.5 s (`.overlay h2`).
- vs AI: after a human move the status shows "thinking"; AI replies after
  ~500 ms (master can take ~1.5 s).
- Analysis: overlay button "Analisar/Analyze" → `.analysis-box` (async,
  can take a few seconds).
- Blitz: `.blitz-timer` counts down from 10 s; timeout plays an automatic
  move.
- Puzzle mode: board pre-filled from a date-seeded position; deterministic
  per day.

## Gotchas

- Game state (settings, profile) persists in localStorage — a fresh browser
  context = clean profile.
- `page.on('pageerror')` + console errors should stay empty; the game logs
  nothing in normal play.
