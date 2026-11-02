// The bestiary: every monster in the game, what it looks like, when it starts
// showing up, and whether the player has met it yet. Discoveries are stored in
// the browser so the archive fills up across runs.

import { ENEMY_TYPES } from './enemies.js';

const KEY = 'meat-battle-bestiary';

export const BESTIARY = [
  {
    key: 'grunt',
    name: '腐行尸',
    wave: 1,
    desc: '最基本的尸潮，数量多、速度慢，靠堆人把你围住。'
  },
  {
    key: 'rusher',
    name: '疾冲者',
    time: 0,
    wave: 2,
    desc: '又瘦又快，会斜插到你前面，专门堵走位。'
  },
  {
    key: 'caster',
    name: '咒术师',
    wave: 3,
    desc: '远远站住朝你丢火球，冲刺的无敌帧能直接穿过去。'
  },
  {
    key: 'brute',
    name: '重装怪',
    wave: 3,
    desc: '血厚、动作慢，撞上来一下就见红，绕着打。'
  },
  {
    key: 'sprinter',
    name: '疾影',
    wave: 4,
    desc: '全场上最快的杂兵，几乎贴着你跑，必须靠冲刺甩开。'
  },
  {
    key: 'elite',
    name: '精英卫兵',
    wave: 4,
    desc: '体型巨大的精英，击杀后掉落大量碎片和武器箱。'
  },
  {
    key: 'mouse',
    name: '茶壶鼠',
    wave: 0,
    desc: '尖叫的茶壶招来的老鼠，脆但极快，击杀能换金币。'
  },
  {
    key: 'boss',
    name: '首领',
    wave: 5,
    desc: '每五波现身一次，会蓄力冲撞和环形弹幕，血条挂在顶部。'
  }
];

function blank() {
  return { seen: [] };
}

export function loadBestiary() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blank();

    const data = JSON.parse(raw);
    return { seen: Array.isArray(data.seen) ? data.seen : [] };
  } catch (error) {
    return blank();
  }
}

function save(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (error) {
    // No storage: discoveries just will not survive a reload.
  }
}

/// Records a meeting with a monster and reports whether it is the first time.
export function markDiscovered(key) {
  if (!key) return false;

  const data = loadBestiary();
  if (data.seen.indexOf(key) !== -1) return false;

  data.seen.push(key);
  save(data);
  return true;
}

/// Everything the archive needs: each entry with its stats and discovery state.
export function bestiaryState() {
  const data = loadBestiary();

  const items = BESTIARY.map((entry) => {
    const def = ENEMY_TYPES[entry.key];
    return {
      key: entry.key,
      name: entry.name,
      wave: entry.wave,
      desc: entry.desc,
      texture: def ? def.texture : 'grunt',
      stats: {
        hp: def ? def.hp : 0,
        speed: def ? def.speed : 0,
        damage: def ? def.damage : 0
      },
      done: data.seen.indexOf(entry.key) !== -1
    };
  });

  return {
    total: items.length,
    found: items.filter((item) => item.done).length,
    items
  };
}
