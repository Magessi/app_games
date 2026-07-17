import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyMove, isValidMove, getLegalMoves, findWinningLine,
  GREEN, YELLOW, RED, EMPTY,
} from '../src/core/game.js';

test('green only on empty, yellow on green, red on yellow', () => {
  let s = createGame();
  assert.equal(isValidMove(s, { row: 0, col: 0, color: GREEN }), true);
  assert.equal(isValidMove(s, { row: 0, col: 0, color: YELLOW }), false);
  assert.equal(isValidMove(s, { row: 0, col: 0, color: RED }), false);

  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  assert.equal(isValidMove(s, { row: 0, col: 0, color: GREEN }), false);
  assert.equal(isValidMove(s, { row: 0, col: 0, color: YELLOW }), true);
  assert.equal(isValidMove(s, { row: 0, col: 0, color: RED }), false);

  s = applyMove(s, { row: 0, col: 0, color: YELLOW });
  assert.equal(isValidMove(s, { row: 0, col: 0, color: RED }), true);

  s = applyMove(s, { row: 0, col: 0, color: RED });
  // red is locked
  for (const color of [GREEN, YELLOW, RED]) {
    assert.equal(isValidMove(s, { row: 0, col: 0, color }), false);
  }
});

test('applyMove is immutable and rejects illegal moves', () => {
  const s = createGame();
  const next = applyMove(s, { row: 0, col: 0, color: GREEN });
  assert.notEqual(next, s);
  assert.equal(s.board[0][0], EMPTY);
  assert.equal(next.board[0][0], GREEN);
  // illegal move returns the same state object
  assert.equal(applyMove(s, { row: 0, col: 0, color: RED }), s);
});

test('piece counts limit moves', () => {
  let s = createGame({ piecesPerColor: 1 });
  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  assert.equal(s.pieces[GREEN], 0);
  assert.equal(isValidMove(s, { row: 1, col: 1, color: GREEN }), false);
});

test('detects horizontal, vertical and diagonal wins', () => {
  // horizontal
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  s = applyMove(s, { row: 0, col: 1, color: GREEN });
  s = applyMove(s, { row: 2, col: 3, color: GREEN });
  s = applyMove(s, { row: 0, col: 2, color: GREEN });
  assert.equal(s.winner, 2); // player 2 completed the line
  assert.deepEqual(s.winningLine, [[0, 0], [0, 1], [0, 2]]);

  // anti-diagonal (top-right to bottom-left)
  let d = createGame();
  d = applyMove(d, { row: 0, col: 3, color: GREEN });
  d = applyMove(d, { row: 1, col: 2, color: GREEN });
  d = applyMove(d, { row: 2, col: 1, color: GREEN });
  assert.equal(d.winner, 1);
});

test('win by top color: covering a green with yellow breaks the line', () => {
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN });  // p1
  s = applyMove(s, { row: 0, col: 1, color: GREEN });  // p2
  s = applyMove(s, { row: 0, col: 0, color: YELLOW }); // p1 covers the green
  s = applyMove(s, { row: 0, col: 2, color: GREEN });  // p2: tops are Y,G,G
  assert.equal(s.winner, null);
  assert.equal(findWinningLine(s), null);
});

test('misere: completing a line loses', () => {
  let s = createGame({ misere: true });
  s = applyMove(s, { row: 0, col: 0, color: GREEN }); // p1
  s = applyMove(s, { row: 0, col: 1, color: GREEN }); // p2
  s = applyMove(s, { row: 2, col: 3, color: GREEN }); // p1
  s = applyMove(s, { row: 0, col: 2, color: GREEN }); // p2 completes -> p2 loses
  assert.equal(s.winner, 1);
});

test('current player alternates and is recorded in history', () => {
  let s = createGame();
  assert.equal(s.currentPlayer, 1);
  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  assert.equal(s.currentPlayer, 2);
  s = applyMove(s, { row: 1, col: 1, color: GREEN });
  assert.deepEqual(s.history.map((m) => m.player), [1, 2]);
});

test('legal move generation matches isValidMove', () => {
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  const legal = getLegalMoves(s);
  assert.equal(legal.length, 12); // 11 empty cells (green) + 1 yellow-on-green
  for (const m of legal) assert.equal(isValidMove(s, m), true);
});

test('4x4 board wins still need only winLength in a row', () => {
  let s = createGame({ rows: 4, cols: 4 });
  s = applyMove(s, { row: 3, col: 0, color: GREEN });
  s = applyMove(s, { row: 3, col: 1, color: GREEN });
  s = applyMove(s, { row: 3, col: 2, color: GREEN });
  assert.equal(s.winner, 1);
});
