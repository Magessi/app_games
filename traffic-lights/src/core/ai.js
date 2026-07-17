// AI opponents. Search works on a mutable scratch copy of the position for
// speed (make/unmake instead of cloning), so the public API stays pure.

import { EMPTY, GREEN, YELLOW, RED, getLines, getLegalMoves, isValidMove, applyMove } from './game.js';

export const AI_LEVELS = ['easy', 'medium', 'hard', 'master'];

const WIN = 1000;

// --- Scratch position -------------------------------------------------------

function makeScratch(state) {
  return {
    rows: state.rows,
    cols: state.cols,
    winLength: state.winLength,
    misere: state.misere,
    board: state.board.map((row) => row.slice()),
    pieces: { [GREEN]: state.pieces[GREEN], [YELLOW]: state.pieces[YELLOW], [RED]: state.pieces[RED] },
    linesThrough: linesThroughCell(state.rows, state.cols, state.winLength),
  };
}

const linesThroughCache = new Map();

function linesThroughCell(rows, cols, len) {
  const key = `${rows}x${cols}x${len}`;
  if (linesThroughCache.has(key)) return linesThroughCache.get(key);
  const map = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));
  for (const line of getLines(rows, cols, len)) {
    for (const [r, c] of line) map[r][c].push(line);
  }
  linesThroughCache.set(key, map);
  return map;
}

function scratchMoves(pos, out) {
  out.length = 0;
  for (let r = 0; r < pos.rows; r++) {
    for (let c = 0; c < pos.cols; c++) {
      const color = pos.board[r][c] + 1;
      if (color <= RED && pos.pieces[color] > 0) out.push({ row: r, col: c, color });
    }
  }
  return out;
}

function completesLine(pos, row, col) {
  for (const line of pos.linesThrough[row][col]) {
    const first = pos.board[line[0][0]][line[0][1]];
    if (first !== EMPTY && line.every(([r, c]) => pos.board[r][c] === first)) return true;
  }
  return false;
}

function make(pos, move) {
  pos.board[move.row][move.col] = move.color;
  pos.pieces[move.color]--;
}

function unmake(pos, move) {
  pos.board[move.row][move.col] = move.color - 1;
  pos.pieces[move.color]++;
}

function posKey(pos) {
  let key = '';
  for (let r = 0; r < pos.rows; r++) key += pos.board[r].join('');
  return key;
}

// --- Search -----------------------------------------------------------------

class SearchTimeout extends Error {}

// Negamax with alpha-beta. Score is from the perspective of the side to
// move: +WIN - ply for a forced win, -WIN + ply for a forced loss, 0 draw.
// Preferring shallower wins (and deeper losses) makes the AI close out games
// and drag out lost ones.
function negamax(pos, depth, ply, alpha, beta, ctx) {
  if (ctx.deadline && (ctx.nodes++ & 255) === 0 && Date.now() > ctx.deadline) {
    throw new SearchTimeout();
  }

  const moves = scratchMoves(pos, []);
  if (moves.length === 0) return 0; // no legal moves: draw

  // Completing a line ends the game: a win for the mover, a loss in misere.
  for (const move of moves) {
    make(pos, move);
    const ends = completesLine(pos, move.row, move.col);
    unmake(pos, move);
    if (ends) {
      const score = pos.misere ? -(WIN - ply - 1) : WIN - ply - 1;
      if (!pos.misere) return score; // can't do better than an immediate win
      move.losing = true;
    }
  }

  if (depth === 0) return 0; // quiet position at horizon: call it balanced

  const key = posKey(pos);
  const cached = ctx.tt.get(key);
  // Only exact scores are safe to reuse — an alpha/beta cutoff stores a bound.
  if (cached && cached.depth >= depth && cached.exact) return cached.score;

  const alphaOrig = alpha;
  let best = -Infinity;
  for (const move of moves) {
    let score;
    if (move.losing) {
      score = -(WIN - ply - 1);
    } else {
      make(pos, move);
      if (completesLine(pos, move.row, move.col)) {
        score = pos.misere ? -(WIN - ply - 1) : WIN - ply - 1;
      } else {
        score = -negamax(pos, depth - 1, ply + 1, -beta, -alpha, ctx);
      }
      unmake(pos, move);
    }
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  ctx.tt.set(key, { depth, score: best, exact: best > alphaOrig && best < beta });
  return best;
}

// Scores every legal move at the given depth. Returns [{move, score}]
// sorted best-first, from the current player's perspective.
export function scoreMoves(state, depth, deadline = null) {
  const pos = makeScratch(state);
  const ctx = { tt: new Map(), nodes: 0, deadline };
  const scored = [];
  for (const move of getLegalMoves(state)) {
    make(pos, move);
    let score;
    if (completesLine(pos, move.row, move.col)) {
      score = pos.misere ? -WIN : WIN;
    } else {
      score = -negamax(pos, depth - 1, 1, -Infinity, Infinity, ctx);
    }
    unmake(pos, move);
    scored.push({ move, score });
  }
  return scored.sort((a, b) => b.score - a.score);
}

// Evaluates the position for the side to move (search only, no heuristic):
// +WIN-ish forced win, -WIN-ish forced loss, 0 unresolved/draw.
export function evaluate(state, depth = 6, timeBudgetMs = null) {
  if (state.winner) return state.winner === state.currentPlayer ? WIN : -WIN;
  if (state.draw) return 0;
  const deadline = timeBudgetMs ? Date.now() + timeBudgetMs : null;
  let best = 0;
  try {
    for (let d = 2; d <= depth; d++) {
      const scored = scoreMoves(state, d, deadline);
      if (scored.length === 0) return 0;
      best = scored[0].score;
      if (Math.abs(best) > WIN / 2) break; // forced result found
    }
  } catch (err) {
    if (!(err instanceof SearchTimeout)) throw err;
  }
  return best;
}

// --- Move selection per level ----------------------------------------------

function shuffle(arr) {
  // Fisher-Yates (the old `.sort(() => Math.random() - .5)` was biased)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function immediateWin(state, moves) {
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next.winner === state.currentPlayer) return move;
  }
  return null;
}

function immediateBlock(state, moves) {
  // A move that leaves the opponent with no winning reply.
  const safe = moves.filter((move) => {
    const next = applyMove(state, move);
    if (next.winner || next.draw) return true;
    return !immediateWin(next, getLegalMoves(next));
  });
  return safe.length ? safe[0] : null;
}

function pickBest(scored) {
  // Randomize among equally-scored top moves so games vary.
  const top = scored.filter((s) => s.score === scored[0].score);
  return top[Math.floor(Math.random() * top.length)].move;
}

export function chooseMove(state, level) {
  const moves = shuffle(getLegalMoves(state));
  if (moves.length === 0) return null;

  switch (level) {
    case 'easy': {
      // Mostly random; only occasionally spots a win.
      if (Math.random() < 0.3) {
        const win = immediateWin(state, moves);
        if (win) return win;
      }
      return moves[0];
    }
    case 'medium': {
      // Take a win, avoid handing one over, otherwise random.
      return immediateWin(state, moves) || immediateBlock(state, moves) || moves[0];
    }
    case 'hard':
      return pickBest(scoreMoves(state, 4));
    case 'master': {
      // Iterative deepening under a time budget with a shared deadline.
      const deadline = Date.now() + 900;
      let best = scoreMoves(state, 2);
      try {
        for (let depth = 3; depth <= 16; depth++) {
          best = scoreMoves(state, depth, deadline);
          if (Math.abs(best[0].score) > WIN / 2) break;
        }
      } catch (err) {
        if (!(err instanceof SearchTimeout)) throw err;
      }
      return pickBest(best);
    }
    default:
      return moves[0];
  }
}

export { WIN };
