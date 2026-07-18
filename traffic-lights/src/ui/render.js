// DOM rendering for the board and the source stacks. Incremental: cells are
// created once per game and updated in place, so a newly placed story is a
// freshly appended element that settles onto the building below it.
//
// PAGODA reskin: each internal "color" is one story of a pagoda, stacked
// bottom-anchored in the cell. GREEN = the base shrine, YELLOW = the second
// story, RED = the crowned top story with the sorin spire. Game logic and
// the piece DOM contract are unchanged — only the visuals differ.

import { EMPTY, GREEN, RED, COLORS, colorName, isValidMove } from '../core/game.js';
import { t } from '../i18n.js';

// Flat-vector stories: no outlines, two-tone shading (warm left face, cool
// right face) via overlay shapes. Every story is a complete building with
// its own flared roof and window.
const STORY_SVG = {
  [GREEN]: `
    <svg viewBox="0 0 100 52" aria-hidden="true">
      <rect class="p-body" x="18" y="26" width="64" height="24" rx="3"/>
      <rect class="p-body-shade" x="50" y="26" width="32" height="24" rx="3"/>
      <rect class="p-window" x="44" y="32" width="12" height="15" rx="6"/>
      <path class="p-roof" d="M1 30 Q50 -10 99 30 Q50 16 1 30 Z"/>
      <path class="p-roof-shade" d="M50 10 Q75 13 99 30 Q75 20.5 50 23 Z"/>
    </svg>`,
  2: `
    <svg viewBox="0 0 100 46" aria-hidden="true">
      <rect class="p-body" x="24" y="24" width="52" height="20" rx="3"/>
      <rect class="p-body-shade" x="50" y="24" width="26" height="20" rx="3"/>
      <rect class="p-window" x="45" y="28" width="10" height="12" rx="5"/>
      <path class="p-roof" d="M4 28 Q50 -8 96 28 Q50 15 4 28 Z"/>
      <path class="p-roof-shade" d="M50 10 Q74 13 96 28 Q73 19 50 21.5 Z"/>
    </svg>`,
  [RED]: `
    <svg viewBox="0 0 100 70" aria-hidden="true">
      <rect class="p-body" x="28" y="42" width="44" height="26" rx="3"/>
      <rect class="p-body-shade" x="50" y="42" width="22" height="26" rx="3"/>
      <circle class="p-lantern" cx="50" cy="56" r="11"/>
      <rect class="p-window" x="45" y="50" width="10" height="13" rx="5"/>
      <path class="p-roof" d="M8 44 Q50 12 92 44 Q50 31 8 44 Z"/>
      <path class="p-roof-shade" d="M50 28 Q72 31 92 44 Q71 36 50 37.5 Z"/>
      <g class="p-sorin">
        <rect x="48.8" y="6" width="2.4" height="24" rx="1.2"/>
        <ellipse cx="50" cy="12" rx="7" ry="2"/>
        <ellipse cx="50" cy="17" rx="5.8" ry="2"/>
        <ellipse cx="50" cy="22" rx="4.6" ry="2"/>
        <circle cx="50" cy="4" r="2.6"/>
      </g>
    </svg>`,
};

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
      // undo: rebuild the cell's stories without animation
      cell.querySelectorAll('.piece').forEach((p) => p.remove());
      for (let v = GREEN; v <= value; v++) cell.appendChild(makePiece(v, false));
    } else if (value > prevValue) {
      for (let v = prevValue + 1; v <= value; v++) {
        const animate = v === value;
        cell.appendChild(makePiece(v, animate));
        if (animate) {
          // A new story settling sends a ripple through the reflection;
          // the spire adds a calm glow bloom on consecration.
          cell.classList.add('rippling');
          if (v === RED) cell.classList.add('bloom');
          setTimeout(() => cell.classList.remove('rippling', 'bloom'), 1200);
        }
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
      `${r + 1},${c + 1}: ${value === EMPTY ? 'empty platform' : t('color.' + colorName(value))}`);
  }
}

function makePiece(color, animate) {
  const piece = document.createElement('span');
  piece.className = `piece ${colorName(color)}${animate ? ' just-placed' : ''}`;
  piece.innerHTML = STORY_SVG[color];
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

// A miniature pagoda of the given stage (stories 1..stage stacked), used as
// the stack glyph so each pool reads as the building it produces.
function pagodaGlyph(stage) {
  const glyph = document.createElement('span');
  glyph.className = 'pagoda-glyph';
  for (let v = GREEN; v <= stage; v++) {
    const story = document.createElement('span');
    story.className = `piece ${colorName(v)}`;
    story.innerHTML = STORY_SVG[v];
    glyph.appendChild(story);
  }
  return glyph;
}

export function createStacks(stacksEl, state) {
  stacksEl.innerHTML = '';
  for (const color of COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stack';
    btn.dataset.color = color;
    btn.setAttribute('aria-label', t('stackAria.' + colorName(color)));
    btn.title = t('stackAria.' + colorName(color));
    const count = document.createElement('span');
    count.className = 'count';
    const pile = document.createElement('span');
    pile.className = 'pile';
    pile.appendChild(pagodaGlyph(color));
    const label = document.createElement('span');
    label.className = 'stack-label';
    label.textContent = t('stack.' + colorName(color));
    btn.append(count, pile, label);
    stacksEl.appendChild(btn);
  }
  updateStacks(stacksEl, state, null, false);
}

export function updateStacks(stacksEl, state, selectedColor, interactive) {
  for (const btn of stacksEl.querySelectorAll('.stack')) {
    const color = +btn.dataset.color;
    const remaining = state.pieces[color];
    btn.querySelector('.count').textContent = remaining;
    const empty = remaining === 0;
    btn.classList.toggle('empty', empty);
    btn.classList.toggle('selected', selectedColor === color);
    btn.disabled = empty || !interactive;
    btn.draggable = !empty && interactive;
  }
}
