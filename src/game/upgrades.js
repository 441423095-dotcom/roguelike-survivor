// The level-up pool: plain numbers only. Anything that changes how a run plays —
// odd trades, pests, poison — is sold in the shop instead (src/game/passives.js).
//
// Each entry changes the run's state object in place; `max` caps its stacks.

import { weaponDef } from './weapons.js';

export const RARITIES = {
  common: { label: '普通', color: 0x39e6cd, hex: '#39e6cd', price: 24 },
  rare: { label: '稀有', color: 0xb07bff, hex: '#b07bff', price: 44 },
  epic: { label: '史诗', color: 0xffd166, hex: '#ffd166', price: 68 }
};

export const UPGRADE_POOL = [
  // ------------------------------------------------------------ baseline
  {
    key: 'damage',
    name: '暴力改装',
    desc: '子弹伤害 +25%',
    icon: 'swords',
    rarity: 'common',
    max: 8,
    apply(s) {
      s.damage *= 1.25;
    }
  },
  {
    key: 'firerate',
    name: '连射装置',
    desc: '射击速度 +15%',
    icon: 'gauge',
    rarity: 'common',
    max: 8,
    apply(s) {
      s.fireInterval = Math.max(80, s.fireInterval * 0.85);
    }
  },
  {
    key: 'speed',
    name: '轻盈步伐',
    desc: '移动速度 +12%',
    icon: 'footprints',
    rarity: 'common',
    max: 6,
    apply(s) {
      s.speed *= 1.12;
    }
  },
  {
    key: 'maxhp',
    name: '坚韧体魄',
    desc: '生命上限 +25，并回复 25',
    icon: 'heart',
    rarity: 'common',
    apply(s) {
      s.maxHp += 25;
      s.hp = Math.min(s.maxHp, s.hp + 25);
    }
  },
  {
    key: 'range',
    name: '加长枪管',
    desc: '射程 +18%，弹速 +10%',
    icon: 'target',
    rarity: 'common',
    apply(s) {
      s.range *= 1.18;
      s.bulletSpeed *= 1.1;
    }
  },
  {
    key: 'magnet',
    name: '磁力核心',
    desc: '拾取范围 +45%',
    icon: 'magnet',
    rarity: 'common',
    max: 4,
    apply(s) {
      s.pickupRadius *= 1.45;
    }
  },
  {
    key: 'regen',
    name: '自愈组织',
    desc: '每秒回复 0.8 点生命',
    icon: 'shield',
    rarity: 'rare',
    max: 3,
    apply(s) {
      s.regen += 0.8;
    }
  },
  {
    key: 'split',
    name: '分裂弹头',
    desc: '每次多发射一颗子弹',
    icon: 'sparkles',
    rarity: 'rare',
    max: 4,
    apply(s) {
      s.projectiles += 1;
    }
  },

  // ---------------------------------------------------------- mechanics
  {
    key: 'pierce',
    name: '裂空弹',
    desc: '所有子弹额外穿透 1 个敌人',
    icon: 'arrow-right',
    rarity: 'rare',
    max: 2,
    apply(s) {
      s.pierceBonus += 1;
    }
  },
  {
    key: 'crit',
    name: '致命一击',
    desc: '15% 概率暴击（伤害 ×2），暴击额外掉落 1 金币',
    icon: 'target',
    rarity: 'rare',
    max: 3,
    apply(s) {
      s.critChance += 0.15;
    }
  },
  {
    key: 'armor',
    name: '合金护板',
    desc: '受到的伤害降低 8%',
    icon: 'shield',
    rarity: 'rare',
    max: 4,
    apply(s) {
      s.armor = Math.min(0.6, s.armor + 0.08);
    }
  },
  {
    key: 'lifesteal',
    name: '嗜血',
    desc: '造成伤害的 4% 回复为生命',
    icon: 'heart',
    rarity: 'epic',
    max: 3,
    apply(s) {
      s.lifesteal += 0.04;
    }
  }
];

export const UPGRADE_BY_KEY = Object.fromEntries(
  UPGRADE_POOL.map((item) => [item.key, item])
);

/// Three cards in random order: pool upgrades that have not hit their cap, plus
/// one strengthening card for each weapon the player is carrying.
export function rollCards(stacks, count, weapons = []) {
  const candidates = [];

  for (const item of UPGRADE_POOL) {
    if (item.max && (stacks[item.key] || 0) >= item.max) continue;
    candidates.push({
      key: item.key,
      name: item.name,
      desc: item.desc,
      icon: item.icon,
      rarity: item.rarity || 'common',
      level: (stacks[item.key] || 0) + 1
    });
  }

  for (const slot of weapons) {
    const def = weaponDef(slot);
    if (!def) continue;
    candidates.push({
      key: `weapon:${slot.key}`,
      name: `${def.name} 强化`,
      desc: '这件武器伤害 +20%，射速 +8%',
      icon: def.icon || 'crosshair',
      rarity: 'rare',
      level: (slot.level || 1) + 1
    });
  }

  const pool = candidates.slice();
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}
