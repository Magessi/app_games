// All user-facing copy for PAGODA.
// (Alternative titles considered: "Three Pagodas", "Sōrin" — "PAGODA" shipped
// as default.)
//
// The i18n structure is kept so more languages can be added later; only
// English ships. Internal color keys (green/yellow/red) are untouched — they
// map to the three pagoda stages: shrine, two stories, consecrated.

const STRINGS = {
  en: {
    title: 'PAGODA',
    tagline: 'Build. Raise. Consecrate.',
    howToPlay: 'How to play',
    rulesIntro: 'A quiet valley. Two builders. One shared pool of pagodas — every building belongs to both of you; only the pattern matters.',
    rulesGoal: 'Align three pagodas of equal height — across, down, or along a diagonal — and the valley is yours.',
    rulesGreen: 'a complete one-story pagoda, on any empty platform.',
    rulesYellow: 'a shrine grows to two stories.',
    rulesRed: 'the pagoda is crowned and consecrated. It can never change again.',
    mode: 'Mode',
    mode1v1: 'Two Builders',
    modeVsAi: 'Solo',
    modePuzzle: 'Daily Puzzle',
    aiLevel: 'The Spirit',
    'level.easy': 'Novice',
    'level.medium': 'Adept',
    'level.hard': 'Expert',
    'level.master': 'Enlightened',
    'level.easy.hint': 'Builds at whim. A gentle first opponent.',
    'level.medium.hint': 'Sees the obvious — takes wins, blocks threats.',
    'level.hard.hint': 'Reads four moves ahead. Patient and exact.',
    'level.master.hint': 'Deep, calm calculation. Defeating it is the final trophy.',
    variants: 'Variants',
    boardSize: 'Valley',
    misere: 'Reversal — whoever aligns three, loses',
    blitz: 'Blitz — 10 s per move',
    players: 'Builders',
    player1: 'Builder 1',
    player2: 'Builder 2',
    computer: 'The Spirit',
    startGame: 'Begin',
    restart: 'Rebuild',
    undo: 'Undo',
    turnOf: '{name} builds',
    thinking: 'The Spirit contemplates…',
    invalidMove: 'That cannot be built there.',
    youWin: '{name} wins — three pagodas stand in line.',
    draw: 'Stillness. No line of three — a draw.',
    puzzleWin: 'The riddle yields — solved.',
    puzzleFail: 'The riddle holds — try again.',
    puzzleGoal: 'Win within two of your moves. The Spirit defends.',
    puzzleDay: 'Riddle of {date}',
    playAgain: 'Play again',
    backToMenu: 'Menu',
    retryPuzzle: 'Try again',
    gameTime: 'Duration: {time}',
    moves: 'Moves',
    analysis: 'The game, remembered',
    analyze: 'Recall the game',
    analyzing: 'Remembering…',
    turningPoint: 'Turning point: move {n} — {player} {action} at {cell}.',
    biggestMistake: 'Costliest move: {n} — {player} {action} at {cell}, and the advantage crossed the water.',
    cleanGame: 'A calm, even game — no clear missteps.',
    evalChartHint: 'Advantage over time (up: {p1}; down: {p2})',
    stats: 'The record',
    statsWins: 'Wins vs the Spirit',
    statsStreak: 'Current streak',
    statsBestStreak: 'Best streak',
    puzzleStreak: 'Riddle streak',
    achievements: 'Honors',
    'ach.firstWin': 'First Light',
    'ach.firstWin.desc': 'Win a game against the Spirit.',
    'ach.beatHard': 'Master Builder',
    'ach.beatHard.desc': 'Defeat the Expert Spirit.',
    'ach.beatMaster': 'Enlightened',
    'ach.beatMaster.desc': 'Defeat the Enlightened Spirit.',
    'ach.noRed': 'Humble Path',
    'ach.noRed.desc': 'Win without placing a single spire.',
    'ach.fastWin': 'Swift Wind',
    'ach.fastWin.desc': 'Win in six of your moves or fewer.',
    'ach.puzzle3': 'Riddle Keeper',
    'ach.puzzle3.desc': 'Solve three daily riddles.',
    achUnlocked: 'Honor earned:',
    // Stage names (internal keys stay green/yellow/red)
    'color.green': 'shrine',
    'color.yellow': 'two-story pagoda',
    'color.red': 'consecrated pagoda',
    'action.green': 'built a shrine',
    'action.yellow': 'raised a story',
    'action.red': 'placed the spire',
    'stack.green': 'Shrines',
    'stack.yellow': 'Stories',
    'stack.red': 'Spires',
    'stackAria.green': 'Build a shrine',
    'stackAria.yellow': 'Raise a story',
    'stackAria.red': 'Place the spire',
    sound: 'Sound',
    theme: 'Mood',
    'theme.auto': 'Auto',
    'theme.light': 'Dawn',
    'theme.dark': 'Dusk',
    timeLeft: 'Time',
    timeoutMove: 'Time drifted by — a move was made.',
    piecesLeft: 'Remaining',
    lastMove: 'last move',
  },
};

export function getLang() {
  return 'en';
}

export function setLang() { /* single-language build */ }

export function t(key, slots = {}) {
  let str = STRINGS.en[key] ?? key;
  for (const [name, value] of Object.entries(slots)) {
    str = str.replaceAll(`{${name}}`, String(value));
  }
  return str;
}
