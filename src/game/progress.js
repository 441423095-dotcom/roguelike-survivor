// What a run leaves behind between sessions: which character and difficulty
// were picked, the best results for each difficulty, the banked kill count and
// the characters those numbers have unlocked. Storage can be unavailable, so
// every access is guarded.

import { CHARACTERS, DEFAULT_CHARACTER } from './characters.js';
import { DEFAULT_DIFFICULTY, difficultyFor } from './difficulty.js';

const KEY = 'meat-battle-progress';

function blankBest() {
  return { wave: 0, kills: 0, time: 0 };
}

function blankBests() {
  return { normal: blankBest(), hard: blankBest() };
}

function blank() {
  return {
    character: DEFAULT_CHARACTER,
    difficulty: DEFAULT_DIFFICULTY,
    bests: blankBests(),
    totalKills: 0,
    unlocked: []
  };
}

function normaliseBest(value) {
  return {
    wave: Math.max(0, Number(value && value.wave) || 0),
    kills: Math.max(0, Number(value && value.kills) || 0),
    time: Math.max(0, Number(value && value.time) || 0)
  };
}

/// Adds the convenience figures for whichever difficulty is selected.
function withTotals(progress) {
  const key = progress.difficulty === 'hard' ? 'hard' : DEFAULT_DIFFICULTY;
  progress.difficulty = key;

  const best = progress.bests[key];

  return {
    ...progress,
    bestWave: best.wave,
    bestKills: best.kills,
    bestTime: best.time,
    highestWave: Math.max(progress.bests.normal.wave, progress.bests.hard.wave),
    difficultyName: difficultyFor(key).name
  };
}

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return withTotals(blank());

    const data = JSON.parse(raw);
    const stored = data.bests && typeof data.bests === 'object' ? data.bests : null;

    if (stored) {
      return withTotals({
        character:
          typeof data.character === 'string' ? data.character : DEFAULT_CHARACTER,
        difficulty: data.difficulty === 'hard' ? 'hard' : DEFAULT_DIFFICULTY,
        bests: {
          normal: normaliseBest(stored.normal),
          hard: normaliseBest(stored.hard)
        },
        totalKills: Number(data.totalKills) || 0,
        unlocked: Array.isArray(data.unlocked) ? data.unlocked : []
      });
    }

    // Older saves kept a single set of bests, and an even older one called the
    // best wave "highestWave": both become the normal-difficulty record.
    const legacyWave = data.bestWave !== undefined ? data.bestWave : data.highestWave;

    return withTotals({
      character:
        typeof data.character === 'string' ? data.character : DEFAULT_CHARACTER,
      difficulty: DEFAULT_DIFFICULTY,
      bests: {
        normal: {
          wave: Math.max(0, Number(legacyWave) || 0),
          kills: Math.max(0, Number(data.bestKills) || 0),
          time: Math.max(0, Number(data.bestTime) || 0)
        },
        hard: blankBest()
      },
      totalKills: Number(data.totalKills) || 0,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : []
    });
  } catch (error) {
    return withTotals(blank());
  }
}

function save(progress) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        character: progress.character,
        difficulty: progress.difficulty,
        bests: progress.bests,
        totalKills: progress.totalKills,
        unlocked: progress.unlocked
      })
    );
  } catch (error) {
    // No storage: the run still plays, records just will not survive a reload.
  }
}

export function isUnlocked(progress, character) {
  if (!character.unlock) return true;
  return progress.unlocked.indexOf(character.key) !== -1;
}

/// Remembers the character for the next run and returns the fresh progress.
export function selectCharacter(key) {
  const progress = loadProgress();
  progress.character = key;
  save(progress);
  return loadProgress();
}

/// Remembers the difficulty for the next run; its records are kept apart from
/// the other tier's.
export function selectDifficulty(key) {
  const progress = loadProgress();
  progress.difficulty = key === 'hard' ? 'hard' : DEFAULT_DIFFICULTY;
  save(progress);
  return loadProgress();
}

// Adds every character whose condition is now met, and reports the new ones.
function applyUnlocks(progress) {
  const newly = [];
  const highestWave = Math.max(
    progress.bests.normal.wave,
    progress.bests.hard.wave
  );

  for (const character of CHARACTERS) {
    const unlock = character.unlock;
    if (!unlock) continue;
    if (progress.unlocked.includes(character.key)) continue;

    const done =
      unlock.type === 'wave'
        ? highestWave >= unlock.value
        : progress.totalKills >= unlock.value;

    if (done) {
      progress.unlocked.push(character.key);
      newly.push(character);
    }
  }

  return newly;
}

/// Called whenever a wave begins, so reaching a deep enough wave unlocks.
export function recordWave(wave, difficulty) {
  const progress = loadProgress();
  const key = difficulty === 'hard' ? 'hard' : progress.difficulty;
  const best = progress.bests[key];

  if (wave > best.wave) best.wave = wave;

  const newly = applyUnlocks(progress);
  save(progress);
  return newly;
}

/// Called once when a run ends. Banks the kills, updates whichever bests were
/// beaten for this difficulty and reports them so the summary can call them out.
export function recordRun({ wave, kills, time, difficulty }) {
  const progress = loadProgress();
  const key = difficulty === 'hard' ? 'hard' : progress.difficulty;
  const best = progress.bests[key];

  const runWave = Math.max(0, Math.floor(wave || 0));
  const runKills = Math.max(0, Math.floor(kills || 0));
  const runTime = Math.max(0, time || 0);

  progress.totalKills += runKills;

  const records = {
    wave: runWave > best.wave,
    kills: runKills > best.kills,
    time: runTime > best.time
  };

  if (records.wave) best.wave = runWave;
  if (records.kills) best.kills = runKills;
  if (records.time) best.time = runTime;

  const newly = applyUnlocks(progress);
  save(progress);

  return { records, newly, best: loadProgress() };
}

/// Wipes every saved number, including unlocks — the archive starts over.
export function clearProgress() {
  const cleared = blank();
  save(cleared);
  return loadProgress();
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = `${total % 60}`.padStart(2, '0');
  return `${minutes}:${rest}`;
}
