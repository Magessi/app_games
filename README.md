# app_games

## PAGODA

*Build. Raise. Consecrate.*

A serene abstract strategy game for two builders (or one, against the
Spirit). A shared pool of pagodas floats on still water: build a one-story
shrine on an empty platform, raise it to two stories, or crown it with a
sōrin spire — consecrated pagodas can never change again. Align three
pagodas of equal height, across, down, or diagonally, and the valley is
yours.

**Play now:** open `traffic-lights/dist/pagoda.html` in a browser
(single self-contained file, no dependencies).

### Features

- Solo vs the Spirit (4 levels: Novice, Adept, Expert, Enlightened —
  minimax with alpha-beta pruning), Two Builders, and a date-seeded Daily
  Puzzle ("win within two of your moves")
- Variants: 3×4 or 4×4 valley, Reversal (aligning three loses),
  Blitz (10 s per move)
- Local match analysis (turning point, costliest move, advantage chart) —
  no external APIs
- Tap-to-place with legal-move highlighting plus drag & drop, undo,
  music-box audio, Dawn/Dusk moods, honors and local streaks

### Development

```bash
cd traffic-lights
npm install        # esbuild only
npm test           # pure-core unit tests (node --test)
npm run build      # produces dist/pagoda.html (single file)
npm run dev        # local server at http://127.0.0.1:8000
```

Architecture: `src/core/` is pure logic (rules, AI, analysis, puzzle — no
DOM, testable in Node; internal stage names green/yellow/red map to
shrine/story/spire), `src/ui/` is incremental rendering and effects,
`src/main.js` wires everything through an observable store (`src/store.js`).
See `UPGRADE_PLAN.md` for the original architecture plan.
