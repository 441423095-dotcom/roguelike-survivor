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

/// Rarity weights tilt towards the top tiers as the run goes deeper: wave 1 is
/// almost always white, wave 20 can hand out gold.
export function rollWeaponRarity(wave) {
  const t = Math.min(1, Math.max(0, ((wave || 1) - 1) / 19));

  const weights = [
    78 - 68 * t, // common
    18 + 4 * t, // uncommon
    3.5 + 28.5 * t, // rare
    0.4 + 23.6 * t, // epic
    0.1 + 11.9 * t // legendary
  ];

  let total = 0;
  for (const weight of weights) total += weight;

  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return WEAPON_RARITIES[i];
  }
  return WEAPON_RARITIES[0];
}

/// One line describing what the tier adds, shown on the shop card.
export function rarityDesc(rarity) {
  const parts = [`伤害 ×${rarity.damage}`];
  if (rarity.pierce) parts.push(`穿透 +${rarity.pierce}`);
  if (rarity.projectiles) parts.push(`弹丸 +${rarity.projectiles}`);
  if (rarity.splash) parts.push(`溅射 +${rarity.splash}`);

  return `${rarity.name}：${parts.join(' · ')}`;
}

export function weaponPrice(key, rarity, wave) {
  const base = WEAPON_BASE_PRICE[key] || 24;
  const raw = base * rarity.price + Math.max(0, wave - 1) * 2;
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

/// A pair merge is cheap on purpose: it is a reward for collecting duplicates.
export function mergeCost(rarityKey) {
  const rarity = rarityFor(rarityKey);
  return 10 * (rarity.rank + 1);
}
