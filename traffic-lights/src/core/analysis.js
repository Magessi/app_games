// Local match analysis: replays the game and evaluates every position with
// the search engine. No external API needed.

import { createGame, applyMove } from './game.js';
import { evaluate, WIN } from './ai.js';

// Returns { evals, turningPoint, mistake }.
// evals[i]: evaluation AFTER move i, from player 1's perspective, in [-1, 1]
// (0 = unresolved, sign = who has a forced win, magnitude = how close it is).
// `yieldFn` (optional) is awaited between positions so a browser UI can keep
// painting during the multi-second analysis.
export async function analyzeGame(finishedState, yieldFn = null) {
  const opts = {
    rows: finishedState.rows,
    cols: finishedState.cols,
    piecesPerColor: finishedState.piecesPerColor,
    winLength: finishedState.winLength,
    misere: finishedState.misere,
  };
  let state = createGame(opts);
  const evals = [];

  for (const move of finishedState.history) {
    state = applyMove(state, { row: move.row, col: move.col, color: move.color });
    let score;
    if (state.winner) {
      score = state.winner === 1 ? WIN : -WIN;
    } else if (state.draw) {
      score = 0;
    } else {
      const forMover = evaluate(state, 8, 150);
      score = state.currentPlayer === 1 ? forMover : -forMover;
    }
    // Map to [-1, 1]: forced results scale with proximity (a mate-in-1 counts
    // more than a mate-in-9), unresolved positions sit at 0.
    const norm = Math.abs(score) > WIN / 2
      ? Math.sign(score) * (0.5 + 0.5 * (Math.abs(score) / WIN))
      : 0;
    evals.push(Math.max(-1, Math.min(1, norm)));
    if (yieldFn) await yieldFn();
  }

  const winner = finishedState.winner; // null on draw
  let turningPoint = null;
  let mistake = null;

  if (winner) {
    const sign = winner === 1 ? 1 : -1;
    // Turning point: first move after which the eval stays on the winner's
    // side until the end of the game.
    for (let i = 0; i < evals.length; i++) {
      if (evals.slice(i).every((e) => e * sign > 0)) {
        turningPoint = i;
        break;
      }
    }
    // Biggest mistake: the loser's move with the largest swing toward the
    // winner (comparing the eval before and after that move).
    let worstSwing = 0;
    finishedState.history.forEach((move, i) => {
      if (move.player === winner) return;
      const before = i === 0 ? 0 : evals[i - 1];
      const swing = (evals[i] - before) * sign;
      if (swing > worstSwing) {
        worstSwing = swing;
        mistake = i;
      }
    });
  }

  return { evals, turningPoint, mistake };
}
