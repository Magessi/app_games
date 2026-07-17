import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyMove, GREEN, YELLOW, RED } from '../src/core/game.js';
import { chooseMove, scoreMoves, evaluate, WIN } from '../src/core/ai.js';
import { analyzeGame } from '../src/core/analysis.js';
import { generateDailyPuzzle } from '../src/core/puzzle.js';

// Position where the side to move can win immediately: two greens in a row,
// third cell empty.
function winInOnePosition() {
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN }); // p1
  s = applyMove(s, { row: 2, col: 3, color: GREEN }); // p2
  s = applyMove(s, { row: 0, col: 1, color: GREEN }); // p1
  s = applyMove(s, { row: 2, col: 2, color: GREEN }); // p2 threatens too
  return s; // p1 to move, 0,2 wins
}

test('medium/hard/master take an immediate win', () => {
  for (const level of ['medium', 'hard', 'master']) {
    const s = winInOnePosition();
    const move = chooseMove(s, level);
    const next = applyMove(s, move);
    assert.equal(next.winner, 1, `${level} should win on the spot`);
  }
});

test('medium avoids handing over an immediate win when possible', () => {
  // p2 to move; p1 threatens green line at [0,2]. Any safe p2 move must
  // neutralize it (complete own line, take the cell, or cover a green).
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN }); // p1
  s = applyMove(s, { row: 1, col: 0, color: GREEN }); // p2
  s = applyMove(s, { row: 0, col: 1, color: GREEN }); // p1 threat
  const move = chooseMove(s, 'medium');
  const after = applyMove(s, move);
  if (!after.winner) {
    // p1 must not have a winning reply
    const replies = scoreMoves(after, 1);
    assert.ok(replies.every((r) => r.score < WIN / 2), 'p1 still has a win after block');
  }
});

test('scoreMoves finds forced win-in-1 with top score', () => {
  const s = winInOnePosition();
  const scored = scoreMoves(s, 3);
  assert.ok(scored[0].score > WIN / 2);
  const best = applyMove(s, scored[0].move);
  assert.equal(best.winner, 1);
});

test('evaluate reports forced win for side to move', () => {
  const s = winInOnePosition();
  assert.ok(evaluate(s, 4) > WIN / 2);
});

test('analysis produces one eval per move and spots the end', async () => {
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  s = applyMove(s, { row: 1, col: 0, color: GREEN });
  s = applyMove(s, { row: 0, col: 1, color: GREEN });
  s = applyMove(s, { row: 1, col: 1, color: GREEN });
  s = applyMove(s, { row: 0, col: 2, color: GREEN }); // p1 wins
  const { evals, turningPoint } = await analyzeGame(s);
  assert.equal(evals.length, 5);
  assert.equal(evals.at(-1), 1); // decisive for p1
  assert.notEqual(turningPoint, null);
});

test('daily puzzle is deterministic and winnable', () => {
  const a = generateDailyPuzzle('2026-07-17');
  const b = generateDailyPuzzle('2026-07-17');
  assert.ok(a, 'puzzle generated');
  assert.deepEqual(a.state.board, b.state.board);
  // side to move has a forced win within the allowed moves
  const plies = a.movesAllowed * 2 - 1;
  const scored = scoreMoves(a.state, plies);
  assert.ok(scored[0].score > WIN / 2);
});

test('master plays a full game without crashing and games end', () => {
  let s = createGame();
  let guard = 0;
  while (!s.winner && !s.draw && guard++ < 30) {
    const move = chooseMove(s, s.currentPlayer === 1 ? 'medium' : 'master');
    s = applyMove(s, move);
  }
  assert.ok(s.winner || s.draw, 'game reached a terminal state');
});
