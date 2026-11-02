// What a run leaves behind between sessions: which character was picked, the
// three best results, the banked kill count and the characters those numbers
// have unlocked. Storage can be unavailable, so every access is guarded.

import { CHARACTERS, DEFAULT_CHARACTER } from './characters.js';

const KEY = 'meat-battle-progress';

function blank() {
  return {
    character: DEFAULT_CHARACTER,
    bestWave: 0,
    bestKills: 0,
    bestTime: 0,
    totalKills: 0,
    unlocked: []
  };
}

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blank();

    const data = JSON.parse(raw);
    // Earlier saves called the best wave "highestWave"; keep reading that form.
    const bestWave =
      data.bestWave !== undefined
        ? Number(data.bestWave) || 0
        : Number(data.highestWave) || 0;

    return {
      character:
        typeof data.character === 'string' ? data.character : DEFAULT_CHARACTER,
      bestWave,
      bestKills: Number(data.bestKills) || 0,
      bestTime: Number(data.bestTime) || 0,
      totalKills: Number(data.totalKills) || 0,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : []
    };
  } catch (error) {
    return blank();
  }
}

function save(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
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
  return progress;
}

// Adds every character whose condition is now met, and reports the new ones.
function applyUnlocks(progress) {
  const newly = [];

  for (const character of CHARACTERS) {
    const unlock = character.unlock;
    if (!unlock) continue;
    if (progress.unlocked.indexOf(character.key) !== -1) continue;

    const done =
      unlock.type === 'wave'
        ? progress.bestWave >= unlock.value
        : progress.totalKills >= unlock.value;

    if (done) {
      progress.unlocked.push(character.key);
      newly.push(character);
    }
  }

  return newly;
}

/// Called whenever a wave begins, so reaching a deep enough wave unlocks.
export function recordWave(wave) {
  const progress = loadProgress();
  if (wave > progress.bestWave) progress.bestWave = wave;

  const newly = applyUnlocks(progress);
  save(progress);
  return newly;
}

/// Called once when a run ends. Banks the kills, updates whichever bests were
/// beaten and reports them so the summary can call them out.
export function recordRun({ wave, kills, time }) {
  const progress = loadProgress();

  const runWave = Math.max(0, Math.floor(wave || 0));
  const runKills = Math.max(0, Math.floor(kills || 0));
  const runTime = Math.max(0, time || 0);

  progress.totalKills += runKills;

  const records = {
    wave: runWave > progress.bestWave,
    kills: runKills > progress.bestKills,
    time: runTime > progress.bestTime
  };

  if (records.wave) progress.bestWave = runWave;
  if (records.kills) progress.bestKills = runKills;
  if (records.time) progress.bestTime = runTime;

  const newly = applyUnlocks(progress);
  save(progress);

  return { records, newly, best: { ...progress } };
}

/// Wipes every saved number, including unlocks — the archive starts over.
export function clearProgress() {
  const cleared = blank();
  save(cleared);
  return cleared;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = `${total % 60}`.padStart(2, '0');
  return `${minutes}:${rest}`;
}
