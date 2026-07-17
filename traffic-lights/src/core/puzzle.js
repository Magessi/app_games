// Daily puzzle: a seeded position where the side to move has a forced win
// within two of their own moves ("win in 2"). Deterministic per date, so
// everyone gets the same puzzle each day.

import { createGame, applyMove, getLegalMoves, isOver } from './game.js';
import { scoreMoves, WIN } from './ai.js';

// mulberry32 - small, good-enough seeded PRNG
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Forced win for the side to move within `plies` half-moves?
function forcedWinDepth(state, plies) {
  const scored = scoreMoves(state, plies);
  return scored.length > 0 && scored[0].score > WIN / 2;
}

// Generates the puzzle for a given date key. Plays seeded random moves and
// looks for a position that is a win-in-2 (depth 3) for the side to move but
// NOT a trivial win-in-1. Falls back to a win-in-1 if the search space is
// unlucky (bounded attempts keep startup fast).
export function generateDailyPuzzle(dateKey = todayKey()) {
  const random = rng(hashString(`traffic-lights:${dateKey}`));
  let fallback = null;

  for (let attempt = 0; attempt < 400; attempt++) {
    let state = createGame();
    const targetMoves = 6 + Math.floor(random() * 8);
    for (let i = 0; i < targetMoves && !isOver(state); i++) {
      const moves = getLegalMoves(state);
      state = applyMove(state, moves[Math.floor(random() * moves.length)]);
    }
    if (isOver(state)) continue;

    const winIn1 = forcedWinDepth(state, 1);
    const winIn3 = forcedWinDepth(state, 3);
    if (winIn3 && !winIn1) {
      return { state, dateKey, humanPlayer: state.currentPlayer, movesAllowed: 2 };
    }
    if (winIn1 && !fallback) {
      fallback = { state, dateKey, humanPlayer: state.currentPlayer, movesAllowed: 1 };
    }
  }
  return fallback; // may be null on a pathological seed; caller handles it
}
