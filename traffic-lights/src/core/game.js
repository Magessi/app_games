// Pure game logic. No DOM, no side effects: every function takes a state
// and returns a value or a new state.
//
// A cell holds an int 0..3. Because stacking is strictly Green -> Yellow ->
// Red, the top piece fully determines the stack: 1 means [G], 2 means [G,Y],
// 3 means [G,Y,R]. This keeps the state tiny and makes AI search cheap.

export const EMPTY = 0;
export const GREEN = 1;
export const YELLOW = 2;
export const RED = 3;
export const COLORS = [GREEN, YELLOW, RED];

const lineCache = new Map();

// All segments of `len` contiguous cells (rows, columns, both diagonal
// directions), as arrays of [row, col] pairs.
export function getLines(rows, cols, len) {
  const key = `${rows}x${cols}x${len}`;
  if (lineCache.has(key)) return lineCache.get(key);
  const lines = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of dirs) {
        const endR = r + dr * (len - 1);
        const endC = c + dc * (len - 1);
        if (endR < 0 || endR >= rows || endC < 0 || endC >= cols) continue;
        lines.push(Array.from({ length: len }, (_, i) => [r + dr * i, c + dc * i]));
      }
    }
  }
  lineCache.set(key, lines);
  return lines;
}

export function createGame(opts = {}) {
  const {
    rows = 3,
    cols = 4,
    piecesPerColor = 8,
    winLength = 3,
    misere = false,
  } = opts;
  return {
    rows,
    cols,
    winLength,
    misere,
    piecesPerColor,
    board: Array.from({ length: rows }, () => Array(cols).fill(EMPTY)),
    pieces: { [GREEN]: piecesPerColor, [YELLOW]: piecesPerColor, [RED]: piecesPerColor },
    currentPlayer: 1,
    history: [],
    winner: null,     // 1 | 2 | null
    winningLine: null, // [[r,c],[r,c],[r,c]] | null
    draw: false,
  };
}

export function isOver(state) {
  return state.winner !== null || state.draw;
}

export function isValidMove(state, { row, col, color }) {
  if (isOver(state)) return false;
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return false;
  if (!state.pieces[color]) return false;
  // Green needs an empty cell, yellow a green top, red a yellow top.
  return state.board[row][col] === color - 1;
}

export function getLegalMoves(state) {
  const moves = [];
  if (isOver(state)) return moves;
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const color = state.board[row][col] + 1;
      if (color <= RED && state.pieces[color] > 0) moves.push({ row, col, color });
    }
  }
  return moves;
}

// Finds a completed line, or null. Only lines through (row, col) can have
// been completed by the last move, so pass it to keep the check cheap.
export function findWinningLine(state, lastRow = null, lastCol = null) {
  for (const line of getLines(state.rows, state.cols, state.winLength)) {
    if (lastRow !== null && !line.some(([r, c]) => r === lastRow && c === lastCol)) continue;
    const first = state.board[line[0][0]][line[0][1]];
    if (first !== EMPTY && line.every(([r, c]) => state.board[r][c] === first)) {
      return line;
    }
  }
  return null;
}

// Immutable: returns a new state (or the same state for an illegal move).
export function applyMove(state, move) {
  if (!isValidMove(state, move)) return state;
  const next = structuredClone(state);
  next.board[move.row][move.col] = move.color;
  next.pieces[move.color]--;
  next.history.push({ ...move, player: state.currentPlayer });
  const line = findWinningLine(next, move.row, move.col);
  if (line) {
    next.winningLine = line;
    // In misere mode, completing a line loses.
    next.winner = state.misere ? 3 - state.currentPlayer : state.currentPlayer;
  } else if (getLegalMoves(next).length === 0) {
    next.draw = true;
  } else {
    next.currentPlayer = 3 - state.currentPlayer;
  }
  return next;
}

export function colorName(color) {
  return color === GREEN ? 'green' : color === YELLOW ? 'yellow' : color === RED ? 'red' : 'empty';
}
