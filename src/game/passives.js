// The shop's shelf. Level-ups hand out numbers; the shop hands out habits,
// trades, pests and gadgets.
//
// Passive items are always on. Active items carry a cooldown: they fire
// themselves every few seconds and show a recharge ring in the HUD column. The
// ones that touch the arena — the frog's gas, the teapot's mice, the piggy
// bank's doubled coins, every active — are driven by GameScene, which reads the
// stack count out of its item table.

/// The frog winds up only while the player is actually walking, and every extra
/// copy winds it tighter.
export function frogInterval(stacks) {
  return Math.max(3, 7 - 2.5 * (Math.max(1, stacks) - 1));
}

/// Two teapots scream twice as often, and a mouse at a time is plenty.
export function teapotInterval(stacks) {
  return Math.max(2, 4 - 1.5 * (Math.max(1, stacks) - 1));
}

// Seconds between triggers, by stack count.
const ACTIVE_COOLDOWNS = {
  flamer: [5, 3.5],
  mine: [3.5, 2.5],
  totem: [12, 9],
  emp: [9, 7],
  chicken: [10, 8],
  blackhole: [15, 12]
};

export function activeCooldown(key, stacks) {
  const pair = ACTIVE_COOLDOWNS[key] || [8, 8];
  const index = Math.min(1, Math.max(0, (stacks || 1) - 1));
  return pair[index];
}

export const PASSIVE_POOL = [
  {
    key: 'frog',
    name: '发条青蛙',
    emoji: '🐸',
    color: 0x7fe36b,
    hex: '#7fe36b',
    max: 3,
    basePrice: 24,
    desc: (level) =>
      `每移动 ${frogInterval(level)} 秒，在原地放个屁：小范围毒气伤害`
  },
  {
    key: 'rustycoin',
    name: '存钱罐',
    emoji: '🐷',
    color: 0xffc94d,
    hex: '#ffc94d',
    max: 1,
    basePrice: 24,
    desc: () => '所有掉落的金币 ×2，金币不再有上限'
  },
  {
    key: 'teapot',
    name: '尖叫的茶壶',
    emoji: '🫖',
    color: 0x63ffe0,
    hex: '#63ffe0',
    max: 2,
    basePrice: 26,
    desc: (level) =>
      `攻速 +20%，每 ${teapotInterval(level)} 秒钻出一只小老鼠（打死掉金币）`,
    apply(state) {
      state.fireInterval = Math.max(80, state.fireInterval * 0.833);
    }
  },
  {
    key: 'coupon',
    name: '打折券',
    emoji: '🎟️',
    color: 0xffd166,
    hex: '#ffd166',
    max: 2,
    basePrice: 20,
    desc: () => '商店所有商品便宜 15%，买第二张再便宜 15%'
  },
  {
    key: 'membercard',
    name: '会员卡',
    emoji: '💳',
    color: 0x63ffe0,
    hex: '#63ffe0',
    max: 1,
    basePrice: 28,
    desc: () => '商店的刷新费用 -40%'
  },
  {
    key: 'bandaid',
    name: '沾血的创可贴',
    emoji: '🩹',
    color: 0xff5a72,
    hex: '#ff5a72',
    max: 3,
    basePrice: 22,
    desc: () => '吸血 +5%，但生命上限 -20',
    apply(state) {
      state.lifesteal += 0.05;
      state.maxHp = Math.max(30, state.maxHp - 20);
      state.hp = Math.min(state.hp, state.maxHp);
    }
  },
  {
    key: 'frost',
    name: '打嗝的冰块',
    emoji: '🧊',
    color: 0x9ce6ff,
    hex: '#9ce6ff',
    max: 1,
    basePrice: 22,
    desc: () => '子弹命中让敌人减速 40%，持续 1.5 秒',
    apply(state) {
      state.slowOnHit = 0.6;
    }
  },
  {
    key: 'pillow',
    name: '午睡枕',
    emoji: '💤',
    color: 0xc79df0,
    hex: '#c79df0',
    max: 2,
    basePrice: 22,
    desc: () => '3 秒没受伤后，每秒回复 2 点生命',
    apply(state) {
      state.outRegen += 2;
    }
  },
  {
    key: 'dice',
    name: '灌铅骰子',
    emoji: '🎲',
    color: 0xb07bff,
    hex: '#b07bff',
    max: 1,
    basePrice: 28,
    desc: () => '每次多发射一颗子弹，但单发伤害 -35%',
    apply(state) {
      state.projectiles += 1;
      state.damage *= 0.65;
    }
  },

  // ---------------------------------------------------- style synergy
  {
    key: 'chip',
    name: '弹药芯片',
    emoji: '🧩',
    color: 0x39e6cd,
    hex: '#39e6cd',
    max: 3,
    basePrice: 24,
    desc: () => '子弹类武器（手炮、散弹、冲锋、毒针）伤害 +20%',
    apply(state) {
      state.styleBonus.bullet = (state.styleBonus.bullet || 1) * 1.2;
    }
  },
  {
    key: 'capacitor',
    name: '能量电容',
    emoji: '🔋',
    color: 0x8fd8ff,
    hex: '#8fd8ff',
    max: 2,
    basePrice: 26,
    desc: () => '能量类武器伤害 +15%，且所有子弹额外穿透 1 个敌人',
    apply(state) {
      state.styleBonus.energy = (state.styleBonus.energy || 1) * 1.15;
      state.pierceBonus += 1;
    }
  },
  {
    key: 'boom',
    name: '烈性炸药',
    emoji: '🧨',
    color: 0xff7a1f,
    hex: '#ff7a1f',
    max: 2,
    basePrice: 26,
    desc: () => '爆炸类武器伤害 +25%，所有溅射范围 +20',
    apply(state) {
      state.styleBonus.explosive = (state.styleBonus.explosive || 1) * 1.25;
      state.splashBonus += 20;
    }
  },
  {
    key: 'link',
    name: '弹链',
    emoji: '⛓️',
    color: 0xffd166,
    hex: '#ffd166',
    max: 3,
    basePrice: 25,
    desc: () => '每多带一把武器，全部武器伤害 +8%（带满 3 把收益最高）',
    apply(state) {
      state.weaponSynergy += 0.08;
    }
  },
  {
    key: 'coolant',
    name: '冷冻剂',
    emoji: '🧴',
    color: 0x9ce6ff,
    hex: '#9ce6ff',
    max: 2,
    basePrice: 26,
    desc: () => '被减速的敌人受到的伤害 +25%',
    apply(state) {
      state.slowBonus += 0.25;
    }
  },
  {
    key: 'chain',
    name: '连锁反应',
    emoji: '☄️',
    color: 0xff9a3f,
    hex: '#ff9a3f',
    max: 2,
    basePrice: 27,
    desc: () => '击杀敌人时引发小爆炸，波及周围敌人',
    apply(state) {
      state.chainKill += 1;
    }
  },

  // ---------------------------------------------------- summons
  {
    key: 'turret',
    name: '固定炮塔',
    emoji: '🗼',
    color: 0x39e6cd,
    hex: '#39e6cd',
    max: 2,
    basePrice: 30,
    desc: (level) =>
      `每波开始时在身旁架起 ${Math.min(2, level)} 座炮塔，自动射击靠近的敌人，波次结束后收起`
  },
  {
    key: 'pet',
    name: '宠物鼠',
    emoji: '🐭',
    color: 0xffd166,
    hex: '#ffd166',
    max: 2,
    basePrice: 26,
    desc: () => '一只跟着你的宠物鼠，会扑上去撕咬靠近的敌人，咬完再跑回来'
  },
  {
    key: 'orb',
    name: '环绕光球',
    emoji: '🔮',
    color: 0x8fd8ff,
    hex: '#8fd8ff',
    max: 2,
    basePrice: 26,
    desc: () => '一颗绕着身体旋转的光球，碰到敌人就造成伤害'
  },
  {
    key: 'drone',
    name: '守卫无人机',
    emoji: '🛸',
    color: 0x63ffe0,
    hex: '#63ffe0',
    max: 2,
    basePrice: 30,
    desc: () => '跟随你的无人机，自动向最近的敌人发射激光'
  },
  {
    key: 'mania',
    name: '狂躁症药丸',
    emoji: '💊',
    color: 0xff5a72,
    hex: '#ff5a72',
    max: 2,
    basePrice: 26,
    desc: () => '攻速 +30%，但每次攻击都会扣掉自己 1 点生命',
    apply(state) {
      state.fireInterval = Math.max(80, state.fireInterval * 0.77);
    }
  },

  // ---------------------------------------------------- late-run power
  {
    key: 'core',
    name: '虚空核心',
    emoji: '🧿',
    color: 0xb07bff,
    hex: '#b07bff',
    max: 1,
    basePrice: 34,
    desc: () => '弹丸 +1，并且所有子弹额外穿透 1 个敌人',
    apply(state) {
      state.projectiles += 1;
      state.pierceBonus += 1;
    }
  },
  {
    key: 'crown',
    name: '暴君王冠',
    emoji: '👑',
    color: 0xffd166,
    hex: '#ffd166',
    max: 2,
    basePrice: 32,
    desc: () => '全部武器伤害 +25%',
    apply(state) {
      state.damage *= 1.25;
    }
  },
  {
    key: 'whetstone',
    name: '淬火磨刀石',
    emoji: '🗡️',
    color: 0xd7e3ea,
    hex: '#d7e3ea',
    max: 2,
    basePrice: 30,
    desc: () => '近战类武器（平底锅、飞刀、回旋镖）伤害 +35%',
    apply(state) {
      state.styleBonus.blade = (state.styleBonus.blade || 1) * 1.35;
    }
  },
  {
    key: 'overclock',
    name: '超频芯片',
    emoji: '🔥',
    color: 0xff7a1f,
    hex: '#ff7a1f',
    max: 3,
    basePrice: 30,
    desc: () => '所有武器攻速 +12%',
    apply(state) {
      state.fireInterval = Math.max(80, state.fireInterval * 0.893);
    }
  }
];

export const ACTIVE_POOL = [
  {
    key: 'flamer',
    name: '喷火器',
    emoji: '🔥',
    color: 0xff7a1f,
    hex: '#ff7a1f',
    active: true,
    max: 2,
    basePrice: 26,
    desc: (level) => `每 ${activeCooldown('flamer', level)} 秒向四周喷火，灼烧身边的敌人`
  },
  {
    key: 'mine',
    name: '地雷发生器',
    emoji: '💣',
    color: 0xff5a72,
    hex: '#ff5a72',
    active: true,
    max: 2,
    basePrice: 24,
    desc: (level) =>
      `每 ${activeCooldown('mine', level)} 秒埋一颗地雷，踩到就爆炸`
  },
  {
    key: 'totem',
    name: '急救图腾',
    emoji: '💉',
    color: 0x39e6cd,
    hex: '#39e6cd',
    active: true,
    max: 2,
    basePrice: 28,
    desc: (level) => `每 ${activeCooldown('totem', level)} 秒回复 12 点生命`
  },
  {
    key: 'emp',
    name: '电磁脉冲',
    emoji: '🌀',
    color: 0x8fd8ff,
    hex: '#8fd8ff',
    active: true,
    max: 2,
    basePrice: 30,
    desc: (level) =>
      `每 ${activeCooldown('emp', level)} 秒冲击波，伤害并减速敌人`
  },
  {
    key: 'chicken',
    name: '尖叫鸡',
    emoji: '🐔',
    color: 0xffd166,
    hex: '#ffd166',
    active: true,
    max: 2,
    basePrice: 28,
    desc: (level) =>
      `每 ${activeCooldown('chicken', level)} 秒尖叫：伤害并减速全场敌人`
  },
  {
    key: 'blackhole',
    name: '黑洞发生器',
    emoji: '🕳️',
    color: 0xb07bff,
    hex: '#b07bff',
    active: true,
    max: 2,
    basePrice: 32,
    desc: (level) =>
      `每 ${activeCooldown('blackhole', level)} 秒开黑洞，吸住敌人再炸开`
  }
];

export const ITEM_POOL = PASSIVE_POOL.concat(ACTIVE_POOL);

export const PASSIVE_BY_KEY = Object.fromEntries(
  PASSIVE_POOL.map((def) => [def.key, def])
);

export const ACTIVE_BY_KEY = Object.fromEntries(
  ACTIVE_POOL.map((def) => [def.key, def])
);

export const ITEM_BY_KEY = Object.fromEntries(
  ITEM_POOL.map((def) => [def.key, def])
);

/// Prices climb a little each wave and a lot each time the player already owns
/// one, so the third frog costs more than the first.
export function itemPrice(def, owned, wave) {
  const base = (def.basePrice || 20) + Math.max(0, owned) * 6 + wave * 2.2;
  return Math.min(60, Math.max(15, Math.round(base / 5) * 5));
}

/// How much 打折券 takes off the shelf: 15% a copy, with a floor so a couple of
/// them cannot make the shop free.
export function shopDiscount(owned) {
  const coupons = owned && owned.coupon ? owned.coupon : 0;
  return Math.max(0.6, 1 - 0.15 * coupons);
}

/// How much 会员卡 takes off a re-roll.
export function refreshDiscount(owned) {
  return owned && owned.membercard ? 0.6 : 1;
}
