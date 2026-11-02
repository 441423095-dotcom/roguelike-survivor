// The level-up pool: character stats only, in Brotato's shape. Weapons never
// appear here — a gun gets stronger by buying a duplicate in the shop and
// fusing the pair — so a level-up always improves the hero herself.
//
// Every card is rolled at one of three tiers, and the tier decides how big the
// number is: a white card is the small version, gold is the one worth taking.

export const RARITY_TIERS = [
  { key: 'common', label: '普通', color: 0x39e6cd, hex: '#39e6cd' },
  { key: 'rare', label: '稀有', color: 0xb07bff, hex: '#b07bff' },
  { key: 'epic', label: '史诗', color: 0xffd166, hex: '#ffd166' }
];

// Kept for anything that still asks for the old shape.
export const RARITIES = {
  common: { label: '普通', color: 0x39e6cd, hex: '#39e6cd', price: 24 },
  rare: { label: '稀有', color: 0xb07bff, hex: '#b07bff', price: 44 },
  epic: { label: '史诗', color: 0xffd166, hex: '#ffd166', price: 68 }
};

/// The stats a level can hand out. `values` is [common, rare, epic]; `apply`
/// takes the rolled amount, so the card really is worth what it says.
export const UPGRADE_POOL = [
  // ------------------------------------------------------------- survival
  {
    key: 'maxhp',
    name: '强健体魄',
    icon: 'heart',
    max: 10,
    values: [10, 16, 24],
    desc: (v) => `生命上限 +${v}`,
    apply(s, v) {
      s.maxHp += v;
      s.hp = Math.min(s.maxHp, s.hp + v);
    }
  },
  {
    key: 'armor',
    name: '合金护板',
    icon: 'shield',
    max: 8,
    values: [0.02, 0.035, 0.05],
    desc: (v) => `受到的伤害 -${Math.round(v * 100)}%`,
    apply(s, v) {
      s.armor = Math.min(0.6, s.armor + v);
    }
  },
  {
    key: 'regen',
    name: '自愈组织',
    icon: 'sparkles',
    max: 6,
    values: [1, 1.6, 2.4],
    desc: (v) => `每秒回复 ${v} 点生命`,
    apply(s, v) {
      s.regen += v;
    }
  },
  {
    key: 'dodge',
    name: '残影步',
    icon: 'footprints',
    max: 4,
    values: [0.05, 0.08, 0.12],
    desc: (v) => `${Math.round(v * 100)}% 概率闪避伤害`,
    apply(s, v) {
      s.dodge = Math.min(0.5, (s.dodge || 0) + v);
    }
  },

  // ------------------------------------------------------------ offence
  {
    key: 'firerate',
    name: '超频供弹',
    icon: 'zap',
    max: 8,
    values: [0.1, 0.16, 0.24],
    desc: (v) => `攻击速度 +${Math.round(v * 100)}%`,
    apply(s, v) {
      s.fireInterval = Math.max(60, s.fireInterval * (1 - v));
    }
  },
  {
    key: 'damage',
    name: '暴力改装',
    icon: 'swords',
    max: 8,
    values: [0.08, 0.13, 0.2],
    desc: (v) => `整体伤害 +${Math.round(v * 100)}%`,
    apply(s, v) {
      s.damage *= 1 + v;
    }
  },
  {
    key: 'crit',
    name: '致命瞄准',
    icon: 'target',
    max: 6,
    values: [0.05, 0.08, 0.12],
    desc: (v) => `暴击率 +${Math.round(v * 100)}%`,
    apply(s, v) {
      s.critChance = Math.min(0.9, s.critChance + v);
    }
  },
  {
    key: 'critdmg',
    name: '处决专精',
    icon: 'crosshair',
    max: 5,
    values: [0.2, 0.32, 0.5],
    desc: (v) => `暴击伤害 +${Math.round(v * 100)}%`,
    apply(s, v) {
      s.critMult += v;
    }
  },
  {
    key: 'magnet',
    name: '磁力核心',
    icon: 'magnet',
    max: 5,
    values: [0.3, 0.45, 0.7],
    desc: (v) => `拾取范围 +${Math.round(v * 100)}%`,
    apply(s, v) {
      s.pickupRadius *= 1 + v;
    }
  },

  // ------------------------------------------------------------- special
  {
    key: 'luck',
    name: '幸运硬币',
    icon: 'coins',
    max: 6,
    values: [5, 8, 12],
    desc: (v) => `幸运 +${v}：商店与掉落的品质更好`,
    apply(s, v) {
      s.luck = (s.luck || 0) + v;
    }
  },
  {
    key: 'speed',
    name: '轻盈步伐',
    icon: 'gauge',
    max: 6,
    values: [0.08, 0.12, 0.18],
    desc: (v) => `移动速度 +${Math.round(v * 100)}%`,
    apply(s, v) {
      s.speed *= 1 + v;
    }
  },

  // ------------------------------------------------------------- utility
  {
    key: 'lifesteal',
    name: '嗜血獠牙',
    icon: 'heart',
    max: 5,
    values: [0.02, 0.035, 0.05],
    desc: (v) => `造成伤害的 ${Math.round(v * 100)}% 转化为生命`,
    apply(s, v) {
      s.lifesteal = Math.min(0.2, s.lifesteal + v);
    }
  },
  {
    key: 'pierce',
    name: '贯穿弹头',
    icon: 'crosshair',
    max: 3,
    values: [1, 1, 2],
    desc: (v) => `所有子弹额外穿透 ${v} 个敌人`,
    apply(s, v) {
      s.pierceBonus += v;
    }
  },
  {
    key: 'splash',
    name: '爆裂弹头',
    icon: 'flame',
    max: 4,
    values: [12, 20, 30],
    desc: (v) => `所有武器获得 ${v} 点溅射范围`,
    apply(s, v) {
      s.splashBonus += v;
    }
  }
];

export const UPGRADE_BY_KEY = Object.fromEntries(
  UPGRADE_POOL.map((item) => [item.key, item])
);

/// Rolls a tier for a card. Purple cards only start showing up from wave six,
/// and stay rare even deep in a run; luck tilts the odds but never unlocks a
/// tier early.
function rollTier(wave, luck) {
  const w = Math.max(1, wave);
  const t = Math.min(1, Math.max(0, (w - 1) / 18));
  const bonus = Math.min(0.5, Math.max(0, luck) / 100);

  const epicChance =
    w < 6 ? 0 : Math.min(0.16, 0.01 + 0.12 * t + bonus * 0.1);
  const rareChance = Math.min(0.34, 0.12 + 0.18 * t + bonus * 0.2);

  const roll = Math.random();
  if (roll < epicChance) return { tier: RARITY_TIERS[2], index: 2 };
  if (roll < epicChance + rareChance) return { tier: RARITY_TIERS[1], index: 1 };
  return { tier: RARITY_TIERS[0], index: 0 };
}

/// Three stat cards in random order, each at its own rolled tier. Weapons are
/// deliberately absent: those grow through the shop's fusions instead.
export function rollCards(stacks, count, wave = 1, luck = 0) {
  const pool = UPGRADE_POOL.filter(
    (item) => !item.max || (stacks[item.key] || 0) < item.max
  );

  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    const stat = pool.splice(index, 1)[0];
    const { tier, index: tierIndex } = rollTier(wave, luck);
    const value = stat.values[tierIndex];

    picked.push({
      key: stat.key,
      name: stat.name,
      desc: stat.desc(value),
      icon: stat.icon,
      value,
      rarity: tier.key,
      rarityLabel: tier.label,
      color: tier.color,
      hex: tier.hex,
      level: (stacks[stat.key] || 0) + 1
    });
  }

  return picked;
}
