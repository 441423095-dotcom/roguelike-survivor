// The achievement archive: a handful of long-term goals, stored in the browser
// next to the records. Every entry reports its own progress as a number, so the
// archive can show "34/100" for the ones still out of reach.

import { CHARACTERS } from './characters.js';

const KEY = 'meat-battle-achievements';

export const ACHIEVEMENTS = [
  {
    key: 'wave5',
    name: '初战告捷',
    desc: '单局撑过第 5 波',
    icon: 'flag',
    goal: 5,
    value: (stats) => Math.min(stats.bestWave, 5)
  },
  {
    key: 'wave10',
    name: '十全十美',
    desc: '单局撑过第 10 波',
    icon: 'target',
    goal: 10,
    value: (stats) => Math.min(stats.bestWave, 10)
  },
  {
    key: 'kills1000',
    name: '千杀传说',
    desc: '累计击杀 1000 只怪',
    icon: 'skull',
    goal: 1000,
    value: (stats) => Math.min(stats.totalKills, 1000)
  },
  {
    key: 'pair',
    name: '双枪在手',
    desc: '同一局里同时持有两把武器',
    icon: 'swords',
    goal: 1,
    value: (stats) => (stats.pair ? 1 : 0)
  },
  {
    key: 'allchars',
    name: '全员出击',
    desc: '用每个角色都打到第 5 波',
    icon: 'users',
    goal: CHARACTERS.length,
    value: (stats) =>
      CHARACTERS.filter((character) => (stats.charsWave[character.key] || 0) >= 5)
        .length
  },
  {
    key: 'cards',
    name: '满手好牌',
    desc: '一次看到四张强化卡',
    icon: 'layers',
    goal: 4,
    value: (stats) => Math.min(stats.maxCards, 4)
  },
  {
    key: 'boss',
    name: '猎首者',
    desc: '击败一个首领',
    icon: 'crown',
    goal: 1,
    value: (stats) => Math.min(stats.bossKills, 1)
  },
  {
    key: 'evolve',
    name: '融为一体',
    desc: '合成一把进化武器',
    icon: 'sparkles',
    goal: 1,
    value: (stats) => Math.min(stats.evolved, 1)
  },
  {
    key: 'rich',
    name: '小有积蓄',
    desc: '单局攒到 50 金币',
    icon: 'coins',
    goal: 50,
    value: (stats) => Math.min(stats.maxCoins, 50)
  },
  {
    key: 'endless',
    name: '越战越勇',
    desc: '进入无尽模式',
    icon: 'infinity',
    goal: 1,
    value: (stats) => (stats.endless ? 1 : 0)
  }
];

// Star dust each achievement pays out when it is claimed from the archive.
const REWARDS = {
  wave5: 20,
  wave10: 30,
  kills1000: 40,
  pair: 15,
  allchars: 40,
  cards: 15,
  boss: 20,
  evolve: 25,
  rich: 20,
  endless: 30
};

for (const def of ACHIEVEMENTS) {
  def.reward = REWARDS[def.key] || 20;
}

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

function blankStats() {
  return {
    bestWave: 0,
    totalKills: 0,
    pair: false,
    charsWave: {},
    maxCards: 0,
    bossKills: 0,
    evolved: 0,
    maxCoins: 0,
    endless: false
  };
}

function blank() {
  return { stats: blankStats(), unlocked: [], claimed: [] };
}

export function loadAchievements() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blank();

    const data = JSON.parse(raw);
    const stored = data && data.stats ? data.stats : {};
    const stats = {
      ...blankStats(),
      ...stored,
      charsWave: stored.charsWave && typeof stored.charsWave === 'object'
        ? { ...stored.charsWave }
        : {}
    };

    return {
      stats,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : [],
      claimed: Array.isArray(data.claimed) ? data.claimed : []
    };
  } catch (error) {
    return blank();
  }
}

function save(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (error) {
    // No storage: achievements just will not survive a reload.
  }
}

/// Merges a patch into the stored numbers, unlocks anything that just completed
/// and returns the definitions that were newly earned.
export function recordAchievement(patch, characterKey) {
  const data = loadAchievements();
  const stats = data.stats;
  const changes = patch || {};

  if (changes.wave !== undefined) {
    stats.bestWave = Math.max(stats.bestWave, changes.wave);
  }
  if (characterKey && changes.wave !== undefined) {
    stats.charsWave[characterKey] = Math.max(
      stats.charsWave[characterKey] || 0,
      changes.wave
    );
  }
  if (changes.totalKills !== undefined) {
    stats.totalKills = Math.max(stats.totalKills, changes.totalKills);
  }
  if (changes.pair) stats.pair = true;
  if (changes.maxCards !== undefined) {
    stats.maxCards = Math.max(stats.maxCards, changes.maxCards);
  }
  if (changes.bossKills) {
    stats.bossKills = Math.max(stats.bossKills, changes.bossKills);
  }
  if (changes.evolved) {
    stats.evolved = Math.max(stats.evolved, 1);
  }
  if (changes.maxCoins !== undefined) {
    stats.maxCoins = Math.max(stats.maxCoins, Math.floor(changes.maxCoins));
  }
  if (changes.endless) stats.endless = true;

  const newly = [];
  for (const def of ACHIEVEMENTS) {
    if (data.unlocked.indexOf(def.key) !== -1) continue;
    if (def.value(stats) >= def.goal) {
      data.unlocked.push(def.key);
      newly.push(def);
    }
  }

  save(data);
  return newly;
}

/// Everything the archive needs: each achievement with its progress and whether
/// it has been earned.
export function achievementState() {
  const data = loadAchievements();

  const items = ACHIEVEMENTS.map((def) => {
    const raw = def.value(data.stats);
    const value = Math.max(0, Math.min(def.goal, Math.floor(raw || 0)));

    return {
      key: def.key,
      name: def.name,
      desc: def.desc,
      icon: def.icon,
      goal: def.goal,
      value,
      reward: def.reward,
      claimed: data.claimed.indexOf(def.key) !== -1,
      done: data.unlocked.indexOf(def.key) !== -1
    };
  });

  return {
    total: ACHIEVEMENT_COUNT,
    done: items.filter((item) => item.done).length,
    items
  };
}

/// Marks one earned achievement as claimed and returns its star dust value,
/// which the archive hands to the meta layer.
export function claimReward(key) {
  const data = loadAchievements();
  if (data.unlocked.indexOf(key) === -1) return 0;
  if (data.claimed.indexOf(key) !== -1) return 0;

  const def = ACHIEVEMENTS.find((entry) => entry.key === key);
  if (!def) return 0;

  data.claimed.push(key);
  save(data);

  return def.reward;
}
