// Local player profile: wins, streaks and achievements in localStorage.

import { RED } from './core/game.js';

const KEY = 'tl.profile';

const DEFAULTS = {
  winsByLevel: { easy: 0, medium: 0, hard: 0, master: 0 },
  lossesByLevel: { easy: 0, medium: 0, hard: 0, master: 0 },
  streak: 0,
  bestStreak: 0,
  puzzlesSolved: 0,
  puzzleStreak: 0,
  lastPuzzleDate: null,
  achievements: [],
};

export function loadProfile() {
  try {
    return { ...structuredClone(DEFAULTS), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(profile) {
  localStorage.setItem(KEY, JSON.stringify(profile));
}

function unlock(profile, id, unlocked) {
  if (!profile.achievements.includes(id)) {
    profile.achievements.push(id);
    unlocked.push(id);
  }
}

// Records a finished vs-AI game. Returns the ids of newly unlocked
// achievements so the UI can announce them.
export function recordAiGame(state, humanPlayer, level, humanWon) {
  const profile = loadProfile();
  const unlocked = [];
  if (humanWon) {
    profile.winsByLevel[level] = (profile.winsByLevel[level] || 0) + 1;
    profile.streak++;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
    unlock(profile, 'firstWin', unlocked);
    if (level === 'hard') unlock(profile, 'beatHard', unlocked);
    if (level === 'master') unlock(profile, 'beatMaster', unlocked);
    const myMoves = state.history.filter((m) => m.player === humanPlayer);
    if (!myMoves.some((m) => m.color === RED)) unlock(profile, 'noRed', unlocked);
    if (myMoves.length <= 6) unlock(profile, 'fastWin', unlocked);
  } else {
    profile.lossesByLevel[level] = (profile.lossesByLevel[level] || 0) + 1;
    profile.streak = 0;
  }
  save(profile);
  return unlocked;
}

export function recordPuzzle(dateKey, solved) {
  const profile = loadProfile();
  const unlocked = [];
  if (solved && profile.lastPuzzleDate !== dateKey) {
    profile.puzzlesSolved++;
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    profile.puzzleStreak = profile.lastPuzzleDate === yesterday ? profile.puzzleStreak + 1 : 1;
    profile.lastPuzzleDate = dateKey;
    if (profile.puzzlesSolved >= 3) unlock(profile, 'puzzle3', unlocked);
    save(profile);
  }
  return unlocked;
}

export const ACHIEVEMENTS = ['firstWin', 'beatHard', 'beatMaster', 'noRed', 'fastWin', 'puzzle3'];
