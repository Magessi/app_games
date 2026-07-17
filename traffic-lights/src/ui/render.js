// DOM rendering for the board and the source stacks. Incremental: cells are
// created once per game and updated in place, so a newly placed piece is a
// freshly appended element that can animate in.

import { EMPTY, GREEN, RED, COLORS, colorName, isValidMove } from '../core/game.js';
import { t } from '../i18n.js';

// --- Board ------------------------------------------------------------------

export function createBoard(boardEl, state) {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, auto)`;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      boardEl.appendChild(cell);
    }
  }
}

export function updateBoard(boardEl, state, prev) {
  const lastMove = state.history.at(-1) ?? null;
  for (const cell of boardEl.querySelectorAll('.cell')) {
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    const value = state.board[r][c];
    const prevValue = prev ? prev.board[r][c] : 0;

    if (value < prevValue) {
      // undo: rebuild the cell's pieces without animation
      cell.querySelectorAll('.piece').forEach((p) => p.remove());
      for (let v = GREEN; v <= value; v++) cell.appendChild(makePiece(v, false));
    } else if (value > prevValue) {
      for (let v = prevValue + 1; v <= value; v++) {
        cell.appendChild(makePiece(v, v === value));
      }
    }

    cell.querySelector('.last-marker')?.remove();
    if (lastMove && lastMove.row === r && lastMove.col === c && !state.winningLine) {
      const marker = document.createElement('span');
      marker.className = 'last-marker';
      marker.title = t('lastMove');
      cell.appendChild(marker);
    }

    const isWinCell = !!state.winningLine?.some(([wr, wc]) => wr === r && wc === c);
    cell.classList.toggle('win-cell', isWinCell);
    cell.setAttribute('aria-label',
      `${r + 1},${c + 1}: ${value === EMPTY ? '—' : t('color.' + colorName(value))}`);
  }
}

function makePiece(color, animate) {
  const piece = document.createElement('span');
  piece.className = `piece ${colorName(color)}${animate ? ' just-placed' : ''}`;
  if (animate) piece.addEventListener('animationend', () => piece.classList.remove('just-placed'), { once: true });
  return piece;
}

// Highlights the cells where `color` can legally be placed; pass null to clear.
export function highlightTargets(boardEl, state, color) {
  for (const cell of boardEl.querySelectorAll('.cell')) {
    const move = { row: +cell.dataset.row, col: +cell.dataset.col, color };
    const legal = color !== null && isValidMove(state, move);
    cell.classList.toggle('legal', legal);
    cell.classList.toggle('dimmed', color !== null && !legal);
  }
}

// Draws the animated stroke across the winning line.
export function drawWinLine(boardEl, line) {
  boardEl.querySelector('.win-line-svg')?.remove();
  const cells = line.map(([r, c]) =>
    boardEl.querySelector(`.cell[data-row='${r}'][data-col='${c}']`));
  if (cells.some((el) => !el)) return;
  const base = boardEl.getBoundingClientRect();
  const centers = [cells[0], cells.at(-1)].map((el) => {
    const b = el.getBoundingClientRect();
    return [b.left - base.left + b.width / 2, b.top - base.top + b.height / 2];
  });
  const [[x1, y1], [x2, y2]] = centers;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'win-line-svg');
  const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lineEl.setAttribute('x1', x1); lineEl.setAttribute('y1', y1);
  lineEl.setAttribute('x2', x2); lineEl.setAttribute('y2', y2);
  lineEl.style.setProperty('--line-len', len);
  svg.appendChild(lineEl);
  boardEl.appendChild(svg);
}

// --- Source stacks ----------------------------------------------------------

export function createStacks(stacksEl, state) {
  stacksEl.innerHTML = '';
  for (const color of COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stack';
    btn.dataset.color = color;
    btn.setAttribute('aria-label', `${t('color.' + colorName(color))}`);
    const count = document.createElement('span');
    count.className = 'count';
    const pile = document.createElement('span');
    pile.className = 'pile';
    btn.append(count, pile);
    stacksEl.appendChild(btn);
  }
  updateStacks(stacksEl, state, null, false);
}

export function updateStacks(stacksEl, state, selectedColor, interactive) {
  for (const btn of stacksEl.querySelectorAll('.stack')) {
    const color = +btn.dataset.color;
    const remaining = state.pieces[color];
    btn.querySelector('.count').textContent = remaining;
    const pile = btn.querySelector('.pile');
    // Draw up to 5 stacked coins as a visual pile.
    const coins = Math.min(remaining, 5);
    if (pile.childElementCount !== coins) {
      pile.innerHTML = '';
      for (let i = 0; i < coins; i++) {
        const coin = document.createElement('span');
        coin.className = `coin ${colorName(color)}`;
        coin.style.bottom = `${i * 4}px`;
        pile.appendChild(coin);
      }
    }
    const empty = remaining === 0;
    btn.classList.toggle('empty', empty);
    btn.classList.toggle('selected', selectedColor === color);
    btn.disabled = empty || !interactive;
    btn.draggable = !empty && interactive;
  }
}
