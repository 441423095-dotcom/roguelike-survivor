// Weapon rarities. A weapon card in the shop is rolled at one of five tiers:
// the tier colours the card, raises the price and adds a flat bonus to the gun
// when it is bought. Higher tiers only start showing up as the run deepens.

export const WEAPON_RARITIES = [
  {
    key: 'common',
    name: '普通',
    word: '白色',
    rank: 0,
    color: 0xd7e3ea,
    hex: '#d7e3ea',
    damage: 1,
    pierce: 0,
    projectiles: 0,
    splash: 0,
    price: 1
  },
  {
    key: 'uncommon',
    name: '优秀',
    word: '绿色',
    rank: 1,
    color: 0x53f08a,
    hex: '#53f08a',
    damage: 1.1,
    pierce: 0,
    projectiles: 0,
    splash: 0,
    price: 1.4
  },
  {
    key: 'rare',
    name: '稀有',
    word: '蓝色',
    rank: 2,
    color: 0x4fb8ff,
    hex: '#4fb8ff',
    damage: 1.22,
    pierce: 1,
    projectiles: 0,
    splash: 0,
    price: 1.9
  },
  {
    key: 'epic',
    name: '史诗',
    word: '紫色',
    rank: 3,
    color: 0xb07bff,
    hex: '#b07bff',
    damage: 1.35,
    pierce: 1,
    projectiles: 1,
    splash: 0,
    price: 2.6
  },
  {
    key: 'legendary',
    name: '传说',
    word: '金色',
    rank: 4,
    color: 0xffd166,
    hex: '#ffd166',
    damage: 1.5,
    pierce: 1,
    projectiles: 1,
    splash: 20,
    price: 3.4
  }
];

// Base price of each gun, before the rarity and wave multipliers.
const WEAPON_BASE_PRICE = {
  blaster: 20,
  smg: 20,
  shotgun: 25,
  piercer: 25,
  frost: 25,
  venom: 28,
  disc: 28,
  pan: 26,
  knife: 24,
  cactus: 28,
  staff: 32,
  mushroom: 28,
  laser: 30,
  sniper: 32,
  rocket: 32,
  void: 46,
  plasma: 42,
  rail: 50,
  storm: 44,
  plane: 34
};

export function rarityFor(key) {
  for (const rarity of WEAPON_RARITIES) {
    if (rarity.key === key) return rarity;
  }
  return WEAPON_RARITIES[0];
}

/// The flat bonuses a carried weapon gets from the tier it was bought at.
export function rarityBonus(key) {
  return rarityFor(key);
}

export function rarityColor(key) {
  return rarityFor(key).color;
}

// How the shelf's quality opens up with the wave. Each anchor is the weight of
// white / green / blue / purple / gold at that wave, and anything in between is
// blended. The tiers are also hard-gated by wave below, so a lucky run cannot
// pull a purple card into an early shop.
const RARITY_CURVE = [
  // Waves 1-5: white and green only, green still the rarer of the two.
  { wave: 1, weights: [88, 12, 0, 0, 0] },
  { wave: 5, weights: [74, 26, 0, 0, 0] },
  // Wave 6: blue appears, as a thin slice of the shelf.
  { wave: 6, weights: [70, 25, 5, 0, 0] },
  { wave: 9, weights: [62, 29, 9, 0, 0] },
  // Wave 10: purple appears, in tiny numbers.
  { wave: 10, weights: [58, 30, 10, 2, 0] },
  { wave: 14, weights: [50, 32, 15, 3, 0] },
  // Wave 15: gold appears, and stays the rarest thing on the shelf.
  { wave: 15, weights: [46, 33, 17, 3, 1] },
  { wave: 20, weights: [38, 34, 21, 6, 1] },
  { wave: 30, weights: [30, 34, 24, 9, 3] }
];

// The wave each tier first becomes possible at. Below its gate a tier's weight
// is zero no matter what the curve or the player's luck says.
const RARITY_GATE = [1, 1, 6, 10, 15];

/// The best tier a wave can roll, whatever a card's own quality floor asks for.
export function maxRankForWave(wave) {
  const w = Math.max(1, wave);
  if (w >= 15) return 4;
  if (w >= 10) return 3;
  if (w >= 6) return 2;
  return 1;
}

/// The blend of tiers this wave rolls from, as weights in rarity order, with
/// every tier still locked at zero until its gate.
export function rarityWeights(wave) {
  const w = Math.max(1, wave || 1);
  const first = RARITY_CURVE[0];
  const last = RARITY_CURVE[RARITY_CURVE.length - 1];

  let weights;
  if (w <= first.wave) {
    weights = first.weights.slice();
  } else if (w >= last.wave) {
    weights = last.weights.slice();
  } else {
    weights = first.weights.slice();
    for (let i = 1; i < RARITY_CURVE.length; i++) {
      const from = RARITY_CURVE[i - 1];
      const to = RARITY_CURVE[i];
      if (w <= to.wave) {
        const t = (w - from.wave) / (to.wave - from.wave);
        weights = from.weights.map(
          (weight, rank) => weight + (to.weights[rank] - weight) * t
        );
        break;
      }
    }
  }

  for (let rank = 0; rank < weights.length; rank++) {
    if (w < RARITY_GATE[rank]) weights[rank] = 0;
  }

  return weights;
}

/// The quality a shelf rolls at: the wave, tilted a little by luck but never
/// far enough to reach a tier this wave has not unlocked yet.
export function qualityForWave(wave, luck = 0) {
  const w = Math.max(1, wave);
  const raw = w + Math.max(0, luck) * 0.35;

  let cap = w;
  for (const gate of RARITY_GATE) {
    if (gate > w) {
      cap = gate - 0.01;
      break;
    }
  }

  return Math.min(raw, cap);
}

/// The worst tier a wave can still roll. White only stops showing late.
export function rarityFloor(wave) {
  const w = Math.max(1, wave || 1);
  if (w >= 25) return 1;
  return 0;
}

/// Rolls one tier for this wave. `minRank` asks for at least that good, but it
/// is clamped to what the wave has unlocked, so a themed card cannot smuggle a
/// purple into a wave-six shop.
export function rollWeaponRarity(wave, minRank = 0) {
  const w = Math.max(1, wave);
  const weights = rarityWeights(w);
  const floor = Math.max(
    0,
    Math.min(minRank, maxRankForWave(w)),
    rarityFloor(w)
  );

  let total = 0;
  for (let i = floor; i < weights.length; i++) total += weights[i];

  if (total <= 0) {
    return WEAPON_RARITIES[Math.min(floor, WEAPON_RARITIES.length - 1)];
  }

  let roll = Math.random() * total;
  for (let i = floor; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return WEAPON_RARITIES[i];
  }

  return WEAPON_RARITIES[Math.min(floor, WEAPON_RARITIES.length - 1)];
}

/// The tier a 数据盲盒 hands out: never white or green, with roughly a third
/// of the rolls purple or gold.
export function rollChestRarity() {
  const roll = Math.random();
  if (roll < 0.08) return rarityFor('legendary');
  if (roll < 0.3) return rarityFor('epic');
  return rarityFor('rare');
}

/// The best tier the shelf is promised to hold. From wave ten a blue card is
/// always on the table; purple and gold are never guaranteed, they have to be
/// rolled.
export function shelfFloor(wave) {
  const w = Math.max(1, wave || 1);
  if (w >= 10) return 2;
  return 0;
}

/// The level a gun is sold at: Lv1 at the start, one more every five waves, so
/// a late shop hands out something that can actually replace what you carry.
export function weaponLevel(wave) {
  const w = Math.max(1, wave || 1);
  return Math.min(5, 1 + Math.floor((w - 1) / 5));
}


/// One line describing what the tier adds, shown on the shop card.
export function rarityDesc(rarity) {
  const parts = [`伤害 ×${rarity.damage}`];
  if (rarity.pierce) parts.push(`穿透 +${rarity.pierce}`);
  if (rarity.projectiles) parts.push(`弹丸 +${rarity.projectiles}`);
  if (rarity.splash) parts.push(`溅射 +${rarity.splash}`);

  return `${rarity.name}：${parts.join(' · ')}`;
}

/// A card's price: the gun's base worth, its tier, the wave it is sold in and
/// the levels it comes with. The better the tier the steeper the wave and level
/// terms, so late shops charge real money for real guns.
export function weaponPrice(key, rarity, wave, level = 1) {
  const base = WEAPON_BASE_PRICE[key] || 24;
  const raw =
    base * rarity.price +
    Math.max(0, wave - 1) * (1.5 + rarity.rank * 0.5) +
    (Math.max(1, level) - 1) * 6 +
    rarity.rank * (2 + Math.max(0, wave) * 0.2);
  return Math.max(15, Math.round(raw / 5) * 5);
}


/// The tier above this one, or null for a legendary weapon.
export function nextRarity(key) {
  const index = WEAPON_RARITIES.findIndex((rarity) => rarity.key === key);
  if (index === -1 || index === WEAPON_RARITIES.length - 1) return null;
  return WEAPON_RARITIES[index + 1];
}

/// The name a carried gun shows: "手炮" when plain, "绿色手炮" once it is
/// anything above the base tier.
export function weaponName(def, rarityKey) {
  if (!def) return '';
  const rarity = rarityFor(rarityKey);
  return rarity.rank === 0 ? def.name : `${rarity.word}${def.name}`;
}

/// Welding two identical guns together is free: collecting the pair is the work.
export function mergeCost() {
  return 0;
}
