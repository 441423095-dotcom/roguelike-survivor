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
  rocket: 32
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
// blended. The first three waves are deliberately white and green only; by wave
// five every shelf promises at least one blue, and a deep run stops showing
// plain white guns almost entirely.
const RARITY_CURVE = [
  { wave: 1, weights: [80, 20, 0, 0, 0] },
  { wave: 3, weights: [62, 38, 0, 0, 0] },
  { wave: 5, weights: [36, 40, 24, 0, 0] },
  { wave: 7, weights: [18, 32, 40, 10, 0] },
  { wave: 10, weights: [6, 20, 40, 30, 4] },
  { wave: 14, weights: [0, 10, 30, 40, 20] },
  { wave: 20, weights: [0, 2, 16, 38, 44] }
];

/// The blend of tiers this wave rolls from, as weights in rarity order.
export function rarityWeights(wave) {
  const w = Math.max(1, wave || 1);
  const first = RARITY_CURVE[0];
  if (w <= first.wave) return first.weights.slice();

  for (let i = 1; i < RARITY_CURVE.length; i++) {
    const from = RARITY_CURVE[i - 1];
    const to = RARITY_CURVE[i];
    if (w <= to.wave) {
      const t = (w - from.wave) / (to.wave - from.wave);
      return from.weights.map(
        (weight, rank) => weight + (to.weights[rank] - weight) * t
      );
    }
  }

  return RARITY_CURVE[RARITY_CURVE.length - 1].weights.slice();
}

/// The worst tier a wave can still roll. Deep runs never fall back to white.
export function rarityFloor(wave) {
  const w = Math.max(1, wave || 1);
  if (w >= 16) return 1;
  return 0;
}

/// Rolls one tier for this wave. `minRank` forces the result to be at least
/// that good, which is how the shop promises a real weapon every visit.
export function rollWeaponRarity(wave, minRank = 0) {
  const weights = rarityWeights(wave);
  const floor = Math.max(minRank, rarityFloor(wave), 0);

  let total = 0;
  for (let i = floor; i < weights.length; i++) total += weights[i];

  if (total <= 0) return WEAPON_RARITIES[Math.min(floor, WEAPON_RARITIES.length - 1)];

  let roll = Math.random() * total;
  for (let i = floor; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return WEAPON_RARITIES[i];
  }

  return WEAPON_RARITIES[Math.min(floor, WEAPON_RARITIES.length - 1)];
}

/// The best tier the shelf is promised to hold: from wave five a blue weapon is
/// always on the table, from wave nine a purple, from wave fourteen a gold.
export function shelfFloor(wave) {
  const w = Math.max(1, wave || 1);
  if (w >= 14) return 3;
  if (w >= 9) return 2;
  if (w >= 5) return 2;
  return 0;
}

/// The level a gun is sold at: Lv1 at the start, one more every three waves, so
/// a late shop hands out something that can actually replace what you carry.
export function weaponLevel(wave) {
  const w = Math.max(1, wave || 1);
  return Math.min(5, 1 + Math.floor((w - 1) / 3));
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

/// The shop's paid shortcut: pushing one carried gun up a tier without a
/// duplicate to fuse it with. This is what 升级 in the gear sheet charges.
export function upgradeCost(rarityKey) {
  const rarity = rarityFor(rarityKey);
  return 20 * (rarity.rank + 1);
}
