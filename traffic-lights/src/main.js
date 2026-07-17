// Controller: wires the pure core to the DOM. Three screens (setup, game,
// win overlay) rendered into #app.

import {
  createGame, applyMove, isValidMove, getLegalMoves, isOver, colorName,
  GREEN, YELLOW, RED, COLORS,
} from './core/game.js';
import { chooseMove, AI_LEVELS } from './core/ai.js';
import { analyzeGame } from './core/analysis.js';
import { generateDailyPuzzle, todayKey } from './core/puzzle.js';
import { createStore } from './store.js';
import { t, getLang, setLang } from './i18n.js';
import { loadProfile, recordAiGame, recordPuzzle, ACHIEVEMENTS } from './profile.js';
import {
  createBoard, updateBoard, updateStacks, createStacks, highlightTargets, drawWinLine,
} from './ui/render.js';
import {
  sound, vibrate, shake, flashInvalid, startConfetti, stopConfetti,
} from './ui/effects.js';

const app = document.getElementById('app');

// --- Settings ---------------------------------------------------------------

const SETTINGS_KEY = 'tl.settings';

function loadSettings() {
  const defaults = {
    mode: 'ai', aiLevel: 'medium', board: '3x4',
    misere: false, blitz: false, p1: '', p2: '',
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

let settings = loadSettings();

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Theme: 'auto' | 'light' | 'dark'
let theme = localStorage.getItem('tl.theme') || 'auto';
applyTheme();

function applyTheme() {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  localStorage.setItem('tl.theme', theme);
}

// --- Tiny DOM helper --------------------------------------------------------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

// --- Session ----------------------------------------------------------------

let session = null; // { mode, aiLevel, humanPlayer, store, undoStack, ... }

function clearSessionTimers() {
  if (!session) return;
  clearTimeout(session.aiTimeout);
  clearInterval(session.blitzInterval);
  session.aiTimeout = null;
  session.blitzInterval = null;
}

function playerName(n) {
  if (!session) return '';
  if (session.mode === '1v1') {
    return n === 1 ? (settings.p1 || t('player1')) : (settings.p2 || t('player2'));
  }
  return n === session.humanPlayer ? (settings.p1 || t('player1')) : t('computer');
}

function isHumanTurn(state) {
  if (isOver(state) || session.aiThinking) return false;
  if (session.mode === '1v1') return true;
  return state.currentPlayer === session.humanPlayer;
}

// --- Setup screen -----------------------------------------------------------

function seg(options, current, onPick) {
  const wrap = el('div', { class: 'seg', role: 'group' });
  for (const opt of options) {
    wrap.appendChild(el('button', {
      type: 'button',
      'aria-pressed': String(opt.value === current),
      onclick: () => onPick(opt.value),
    }, opt.label));
  }
  return wrap;
}

function showSetup() {
  clearSessionTimers();
  stopConfetti();
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  session = null;
  const profile = loadProfile();

  const totalWins = Object.values(profile.winsByLevel).reduce((a, b) => a + b, 0);

  const rerender = () => showSetup();

  const aiLevelField = el('fieldset', {},
    el('legend', {}, t('aiLevel')),
    seg(AI_LEVELS.map((l) => ({ value: l, label: t(`level.${l}`) })), settings.aiLevel,
      (v) => { settings.aiLevel = v; saveSettings(); rerender(); }),
    el('p', { class: 'hint' }, t(`level.${settings.aiLevel}.hint`)),
  );

  const variantsField = el('fieldset', {},
    el('legend', {}, t('variants')),
    el('div', { class: 'seg', style: 'margin-bottom:8px' },
      seg([{ value: '3x4', label: '3 × 4' }, { value: '4x4', label: '4 × 4' }], settings.board,
        (v) => { settings.board = v; saveSettings(); rerender(); })),
    el('label', { class: 'check-row' },
      el('input', {
        type: 'checkbox', checked: settings.misere,
        onchange: (e) => { settings.misere = e.target.checked; saveSettings(); },
      }),
      t('misere')),
    el('label', { class: 'check-row' },
      el('input', {
        type: 'checkbox', checked: settings.blitz,
        onchange: (e) => { settings.blitz = e.target.checked; saveSettings(); },
      }),
      t('blitz')),
  );

  const namesField = el('fieldset', {},
    el('legend', {}, t('player1')),
    el('div', { class: 'name-row' },
      el('label', {}, t('player1'),
        el('input', {
          type: 'text', value: settings.p1, placeholder: t('player1'),
          oninput: (e) => { settings.p1 = e.target.value; saveSettings(); },
        })),
      settings.mode === '1v1'
        ? el('label', {}, t('player2'),
          el('input', {
            type: 'text', value: settings.p2, placeholder: t('player2'),
            oninput: (e) => { settings.p2 = e.target.value; saveSettings(); },
          }))
        : null,
    ),
  );

  const achChips = ACHIEVEMENTS.map((id) => el('span', {
    class: `ach-chip${profile.achievements.includes(id) ? ' unlocked' : ''}`,
    title: t(`ach.${id}.desc`),
  }, t(`ach.${id}`)));

  const panel = el('div', { class: 'panel' },
    el('div', { class: 'topbar' },
      el('button', {
        class: 'icon-btn', type: 'button',
        onclick: () => { setLang(getLang() === 'pt' ? 'en' : 'pt'); rerender(); },
      }, getLang() === 'pt' ? '🇵🇹 PT' : '🇬🇧 EN'),
      el('div', { class: 'spacer' }),
      el('button', {
        class: 'icon-btn', type: 'button', title: t('theme'),
        onclick: () => {
          theme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
          applyTheme(); rerender();
        },
      }, theme === 'auto' ? `☯ ${t('theme.auto')}` : theme === 'dark' ? `🌙 ${t('theme.dark')}` : `☀️ ${t('theme.light')}`),
      el('button', {
        class: 'icon-btn', type: 'button', 'aria-pressed': String(!sound.muted), title: t('sound'),
        onclick: (e) => { sound.toggle(); e.target.setAttribute('aria-pressed', String(!sound.muted)); e.target.textContent = sound.muted ? '🔇' : '🔊'; },
      }, sound.muted ? '🔇' : '🔊'),
    ),
    el('h1', {}, t('title')),
    el('p', { class: 'subtitle' }, t('setupTitle')),
    el('div', { class: 'setup-grid' },
      el('fieldset', {},
        el('legend', {}, t('howToPlay')),
        el('div', { class: 'rules' },
          el('div', {}, t('rulesGoal')),
          el('div', {}, el('span', { class: 'dot g' }), ' ', t('rulesGreen')),
          el('div', {}, el('span', { class: 'dot y' }), ' ', t('rulesYellow')),
          el('div', {}, el('span', { class: 'dot r' }), ' ', t('rulesRed')),
        ),
      ),
      el('fieldset', {},
        el('legend', {}, getLang() === 'pt' ? 'Modo' : 'Mode'),
        seg([
          { value: 'ai', label: t('modeVsAi') },
          { value: '1v1', label: t('mode1v1') },
          { value: 'puzzle', label: t('modePuzzle') },
        ], settings.mode, (v) => { settings.mode = v; saveSettings(); rerender(); }),
        settings.mode === 'puzzle' ? el('p', { class: 'hint' }, t('puzzleGoal')) : null,
      ),
      settings.mode === 'ai' ? aiLevelField : null,
      settings.mode !== 'puzzle' ? variantsField : null,
      settings.mode !== 'puzzle' ? namesField : null,
      el('fieldset', {},
        el('legend', {}, t('stats')),
        el('div', { class: 'progress-row' },
          el('div', {}, el('b', {}, String(totalWins)), t('statsWins')),
          el('div', {}, el('b', {}, String(profile.streak)), t('statsStreak')),
          el('div', {}, el('b', {}, String(profile.bestStreak)), t('statsBestStreak')),
          el('div', {}, el('b', {}, String(profile.puzzleStreak)), t('puzzleStreak')),
        ),
        el('div', { class: 'ach-grid' }, achChips),
      ),
      el('button', { class: 'btn btn-primary btn-wide', type: 'button', onclick: startGame }, t('startGame')),
    ),
  );

  app.replaceChildren(panel);
}

// --- Game screen ------------------------------------------------------------

function startGame() {
  clearSessionTimers();
  stopConfetti();
  document.querySelectorAll('.overlay').forEach((o) => o.remove());

  let initialState;
  let puzzle = null;
  if (settings.mode === 'puzzle') {
    puzzle = generateDailyPuzzle(todayKey());
    if (!puzzle) { settings.mode = 'ai'; saveSettings(); return startGame(); }
    initialState = puzzle.state;
  } else {
    const [rows, cols] = settings.board.split('x').map(Number);
    initialState = createGame({
      rows, cols,
      piecesPerColor: Math.round((rows * cols * 2) / 3),
      misere: settings.misere,
    });
  }

  session = {
    mode: settings.mode,
    aiLevel: settings.aiLevel,
    humanPlayer: puzzle ? puzzle.humanPlayer : 1,
    puzzle,
    puzzleMovesUsed: 0,
    blitz: settings.mode !== 'puzzle' && settings.blitz,
    startTime: Date.now(),
    undoStack: [],
    selectedColor: null,
    aiThinking: false,
    aiTimeout: null,
    blitzInterval: null,
    blitzDeadline: null,
    store: createStore(initialState),
    els: {},
  };

  buildGameScreen(initialState);
  session.store.subscribe(onStateChange);
  onStateChange(initialState, null);
  armBlitzTimer();
}

function buildGameScreen(state) {
  const els = session.els;

  els.playerCards = [1, 2].map((n) => el('div', { class: 'player-card', dataset: { player: n } },
    el('span', { class: 'pip' }),
    el('div', {},
      el('div', { class: 'name' }, playerName(n)),
      el('div', { class: 'meta' }, ''),
    ),
  ));

  els.status = el('p', { class: 'status-line' }, '');
  els.blitzTimer = session.blitz ? el('p', { class: 'blitz-timer' }, '') : null;
  els.stacks = el('div', { class: 'stacks' });
  els.board = el('div', { class: 'board', role: 'grid' });

  els.undoBtn = el('button', {
    class: 'btn btn-ghost', type: 'button', onclick: undoMove, disabled: true,
  }, `↩ ${t('undo')}`);

  const actions = el('div', { class: 'game-actions' },
    session.mode !== 'puzzle' ? els.undoBtn : null,
    el('button', { class: 'btn btn-ghost', type: 'button', onclick: startGame },
      session.mode === 'puzzle' ? t('retryPuzzle') : t('restart')),
    el('button', { class: 'btn btn-ghost', type: 'button', onclick: showSetup }, t('backToMenu')),
  );

  const panel = el('div', { class: 'panel game-panel' },
    el('h1', {}, t('title')),
    session.mode === 'puzzle'
      ? el('p', { class: 'subtitle' }, `${t('puzzleDay', { date: session.puzzle.dateKey })} — ${t('puzzleGoal')}`)
      : null,
    el('div', { class: 'players' }, els.playerCards),
    els.blitzTimer,
    els.status,
    els.stacks,
    els.board,
    actions,
  );

  app.replaceChildren(panel);

  createStacks(els.stacks, state);
  createBoard(els.board, state);
  wireInput();
}

function wireInput() {
  const { board, stacks } = session.els;

  stacks.addEventListener('click', (e) => {
    const btn = e.target.closest('.stack');
    if (!btn || btn.disabled) return;
    const color = +btn.dataset.color;
    session.selectedColor = session.selectedColor === color ? null : color;
    sound.select();
    refreshInteractivity();
  });

  stacks.addEventListener('dragstart', (e) => {
    const btn = e.target.closest('.stack');
    if (!btn || !isHumanTurn(session.store.get())) { e.preventDefault(); return; }
    session.selectedColor = +btn.dataset.color;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', btn.dataset.color);
    refreshInteractivity();
  });

  board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const state = session.store.get();
    if (!isHumanTurn(state)) return;
    const row = +cell.dataset.row;
    const col = +cell.dataset.col;
    // With a stack selected, play that color; otherwise the cell's next color
    // is forced by the rules (green -> yellow -> red), so play that.
    const color = session.selectedColor ?? state.board[row][col] + 1;
    tryHumanMove({ row, col, color }, cell);
  });

  board.addEventListener('dragover', (e) => {
    const cell = e.target.closest('.cell');
    if (cell) { e.preventDefault(); cell.classList.add('drag-over'); }
  });
  board.addEventListener('dragleave', (e) => {
    e.target.closest('.cell')?.classList.remove('drag-over');
  });
  board.addEventListener('drop', (e) => {
    e.preventDefault();
    const cell = e.target.closest('.cell');
    if (!cell) return;
    cell.classList.remove('drag-over');
    const color = +e.dataTransfer.getData('text/plain');
    if (!color) return;
    tryHumanMove({ row: +cell.dataset.row, col: +cell.dataset.col, color }, cell);
  });
  document.addEventListener('dragend', () => {
    session.selectedColor = null;
    if (session.store) refreshInteractivity();
  });
}

function tryHumanMove(move, cellEl) {
  const state = session.store.get();
  if (move.color > RED || !isValidMove(state, move)) {
    sound.invalid();
    if (cellEl) flashInvalid(cellEl);
    setStatus(t('invalidMove'), true);
    return;
  }
  session.undoStack.push(state);
  session.selectedColor = null;
  commitMove(move, true);
}

function commitMove(move, byHuman) {
  const next = applyMove(session.store.get(), move);
  sound.place(move.color);
  if (byHuman) vibrate(12);
  session.store.set(next);
  afterMove(byHuman);
}

function afterMove(byHuman) {
  const state = session.store.get();

  if (session.mode === 'puzzle' && byHuman) {
    session.puzzleMovesUsed++;
  }

  if (isOver(state)) {
    clearSessionTimers();
    handleGameEnd(state);
    return;
  }

  if (session.mode === 'puzzle' && byHuman
      && session.puzzleMovesUsed >= session.puzzle.movesAllowed) {
    // Out of moves without winning: puzzle failed.
    clearSessionTimers();
    handleGameEnd(state, { puzzleFailed: true });
    return;
  }

  armBlitzTimer();
  maybeScheduleAi();
}

function maybeScheduleAi() {
  const state = session.store.get();
  if (session.mode === '1v1' || isOver(state)) return;
  if (state.currentPlayer === session.humanPlayer) return;

  session.aiThinking = true;
  refreshInteractivity();
  setStatus(t('thinking'));
  const level = session.mode === 'puzzle' ? 'master' : session.aiLevel;
  session.aiTimeout = setTimeout(() => {
    const move = chooseMove(session.store.get(), level);
    session.aiThinking = false;
    if (move) commitMove(move, false);
  }, 500);
}

// --- Blitz ------------------------------------------------------------------

const BLITZ_SECONDS = 10;

function armBlitzTimer() {
  if (!session.blitz) return;
  clearInterval(session.blitzInterval);
  const state = session.store.get();
  if (isOver(state)) return;
  // Only the human is on the clock; the AI answers in under a second anyway.
  if (session.mode === 'ai' && state.currentPlayer !== session.humanPlayer) return;

  session.blitzDeadline = Date.now() + BLITZ_SECONDS * 1000;
  updateBlitzLabel();
  session.blitzInterval = setInterval(() => {
    updateBlitzLabel();
    if (Date.now() >= session.blitzDeadline) {
      clearInterval(session.blitzInterval);
      const current = session.store.get();
      if (isOver(current)) return;
      const moves = getLegalMoves(current);
      const move = moves[Math.floor(Math.random() * moves.length)];
      setStatus(t('timeoutMove'), true);
      sound.invalid();
      session.undoStack.push(current);
      commitMove(move, true);
    }
  }, 100);
}

function updateBlitzLabel() {
  const label = session.els.blitzTimer;
  if (!label) return;
  const left = Math.max(0, (session.blitzDeadline - Date.now()) / 1000);
  label.textContent = `⏱ ${left.toFixed(1)}s`;
  label.classList.toggle('low', left <= 3);
}

// --- Undo -------------------------------------------------------------------

function undoMove() {
  if (session.aiThinking || session.undoStack.length === 0) return;
  clearSessionTimers();
  const snapshot = session.undoStack.pop();
  session.selectedColor = null;
  session.store.set(snapshot);
  sound.select();
  armBlitzTimer();
}

// --- State -> UI ------------------------------------------------------------

function onStateChange(state, prev) {
  const { board, stacks, playerCards, undoBtn } = session.els;
  updateBoard(board, state, prev);
  refreshInteractivity();

  for (const card of playerCards) {
    const n = +card.dataset.player;
    card.classList.toggle('active', !isOver(state) && state.currentPlayer === n);
    const moves = state.history.filter((m) => m.player === n).length;
    card.querySelector('.meta').textContent = `${t('moves')}: ${moves}`;
  }

  if (undoBtn) undoBtn.disabled = session.undoStack.length === 0 || session.aiThinking;

  if (!isOver(state)) {
    setStatus(t('turnOf', { name: playerName(state.currentPlayer) }));
  }
}

function refreshInteractivity() {
  const state = session.store.get();
  const interactive = isHumanTurn(state);
  updateStacks(session.els.stacks, state, session.selectedColor, interactive);
  highlightTargets(session.els.board, state, interactive ? session.selectedColor : null);
  if (session.els.undoBtn) {
    session.els.undoBtn.disabled = session.undoStack.length === 0 || session.aiThinking;
  }
}

function setStatus(msg, isError = false) {
  const status = session.els.status;
  status.textContent = msg;
  status.classList.toggle('error', isError);
}

// --- Game end ---------------------------------------------------------------

function handleGameEnd(state, { puzzleFailed = false } = {}) {
  const humanWon = state.winner === session.humanPlayer;
  let unlocked = [];

  if (session.mode === 'ai' && state.winner) {
    unlocked = recordAiGame(state, session.humanPlayer, session.aiLevel, humanWon);
  } else if (session.mode === 'puzzle') {
    if (humanWon) unlocked = recordPuzzle(session.puzzle.dateKey, true);
  }

  // Layered victory sequence: pulse -> line -> shake -> sound -> overlay.
  if (state.winningLine) {
    const cells = state.winningLine.map(([r, c]) =>
      session.els.board.querySelector(`.cell[data-row='${r}'][data-col='${c}']`));
    cells.forEach((cell, i) => { if (cell) cell.style.animationDelay = `${i * 120}ms`; });
    drawWinLine(session.els.board, state.winningLine);
    setTimeout(() => shake(session.els.board), 350);
    vibrate([60, 40, 60]);
  }

  const humanInvolved = session.mode !== '1v1';
  const happy = !humanInvolved ? true : (humanWon && !puzzleFailed);
  setTimeout(() => (happy ? sound.win() : sound.lose()), 250);

  const endedState = state;
  setTimeout(() => showEndOverlay(endedState, { puzzleFailed, humanWon, unlocked }), 1500);

  if (state.winner) {
    setStatus(t('youWin', { name: playerName(state.winner) }));
  } else {
    setStatus(t('draw'));
  }
}

function showEndOverlay(state, { puzzleFailed, humanWon, unlocked }) {
  const seconds = Math.round((Date.now() - session.startTime) / 1000);
  const duration = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  let title;
  if (session.mode === 'puzzle') {
    title = humanWon ? t('puzzleWin') : t('puzzleFail');
  } else if (state.winner) {
    title = t('youWin', { name: playerName(state.winner) });
  } else {
    title = t('draw');
  }

  const statCards = session.mode === 'puzzle' ? [] : [1, 2].map((n) => {
    const mine = state.history.filter((m) => m.player === n);
    const count = (color) => mine.filter((m) => m.color === color).length;
    return el('div', { class: 'stat-card' },
      el('div', { class: 'who' }, playerName(n)),
      el('div', {}, `${t('moves')}: ${mine.length}`),
      el('div', { class: 'pieces' },
        el('span', { class: 'g' }, `● ${count(GREEN)}`),
        el('span', { class: 'y' }, `● ${count(YELLOW)}`),
        el('span', { class: 'r' }, `● ${count(RED)}`),
      ),
    );
  });

  const achToasts = unlocked.map((id) => el('div', { class: 'ach-toast' },
    el('span', { class: 'badge' }, '🏆'),
    el('div', {},
      el('b', {}, `${t('achUnlocked')} ${t(`ach.${id}`)}`),
      t(`ach.${id}.desc`),
    ),
  ));

  const analysisSlot = el('div', {});
  const analyzeBtn = session.mode === '1v1' || session.mode === 'ai'
    ? el('button', {
      class: 'btn btn-ghost', type: 'button',
      onclick: (e) => runAnalysis(state, analysisSlot, e.target),
    }, `📈 ${t('analyze')}`)
    : null;

  const overlay = el('div', { class: 'overlay' },
    el('div', { class: 'panel' },
      el('h2', {}, title),
      el('p', { class: 'sub' }, t('gameTime', { time: duration })),
      statCards.length ? el('div', { class: 'stats-grid' }, statCards) : null,
      achToasts.length ? el('div', { class: 'ach-toast-list' }, achToasts) : null,
      analysisSlot,
      el('div', { class: 'game-actions', style: 'margin-top:20px' },
        analyzeBtn,
        el('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: () => { overlay.remove(); startGame(); },
        }, session.mode === 'puzzle' && !humanWon ? t('retryPuzzle') : t('playAgain')),
        el('button', {
          class: 'btn btn-ghost', type: 'button',
          onclick: () => { overlay.remove(); showSetup(); },
        }, t('backToMenu')),
      ),
    ),
  );

  document.body.appendChild(overlay);

  const humanInvolved = session.mode !== '1v1';
  if (!humanInvolved || (humanWon && !puzzleFailed)) startConfetti();
}

// --- Analysis ---------------------------------------------------------------

async function runAnalysis(state, slot, btn) {
  btn.disabled = true;
  btn.textContent = t('analyzing');
  const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));
  const { evals, turningPoint, mistake } = await analyzeGame(state, yieldFrame);

  const cellName = (m) => `${String.fromCharCode(65 + m.col)}${m.row + 1}`;
  const lines = [];
  if (turningPoint !== null) {
    const m = state.history[turningPoint];
    lines.push(t('turningPoint', {
      n: turningPoint + 1, player: playerName(m.player),
      color: t('color.' + colorName(m.color)), cell: cellName(m),
    }));
  }
  if (mistake !== null && mistake !== turningPoint) {
    const m = state.history[mistake];
    lines.push(t('biggestMistake', {
      n: mistake + 1, player: playerName(m.player),
      color: t('color.' + colorName(m.color)), cell: cellName(m),
    }));
  }
  if (lines.length === 0) lines.push(t('cleanGame'));

  const chart = el('div', { class: 'eval-chart' },
    evals.map((e, i) => {
      const bar = el('div', {
        class: `eval-bar${e < 0 ? ' p2' : ''}${i === turningPoint || i === mistake ? ' marked' : ''}`,
        title: `#${i + 1}: ${e.toFixed(2)}`,
      }, el('i'));
      const inner = bar.querySelector('i');
      const h = Math.max(4, Math.abs(e) * 50);
      if (e >= 0) { inner.style.bottom = '50%'; inner.style.height = `${h}%`; }
      else { inner.style.top = '50%'; inner.style.height = `${h}%`; }
      return bar;
    }),
  );

  slot.replaceChildren(el('div', { class: 'analysis-box' },
    el('h3', {}, `📈 ${t('analysis')}`),
    ...lines.map((l) => el('p', {}, l)),
    chart,
    el('p', { class: 'chart-hint' }, t('evalChartHint', { p1: playerName(1), p2: playerName(2) })),
  ));
  btn.remove();
}

// --- Boot -------------------------------------------------------------------

showSetup();
