// The meta layer: star dust earned at the end of every run and spent between
// runs on permanent perks, locked characters and player tints. Nothing here is
// spent inside a run — in-run coins stay in-run.

const KEY = 'meat-battle-meta';

export const META_PERKS = [
  {
    key: 'health',
    name: '强健体魄',
    icon: 'heart',
    desc: '每局开局生命上限 +10',
    max: 5,
    cost: (level) => 100 * (level + 1),
    value: 10
  },
  {
    key: 'damage',
    name: '锋锐本能',
    icon: 'swords',
    desc: '每局开局伤害 +5%',
    max: 5,
    cost: (level) => 120 * (level + 1),
    value: 0.05
  },
  {
    key: 'speed',
    name: '轻快脚步',
    icon: 'footprints',
    desc: '每局开局移动速度 +4%',
    max: 3,
    cost: (level) => 100 * (level + 1),
    value: 0.04
  }
];

export const META_SKINS = [
  { key: 'default', name: '原色', desc: '保持角色原本的配色', tint: null, cost: 0 },
  { key: 'emerald', name: '翠绿', desc: '把角色染成翠绿', tint: 0x8ef0b0, cost: 150 },
  { key: 'amber', name: '琥珀', desc: '把角色染成琥珀金', tint: 0xffd166, cost: 150 },
  { key: 'frost', name: '霜蓝', desc: '把角色染成霜蓝', tint: 0x9ce6ff, cost: 200 }
];

export const META_CHARACTER_COSTS = {
  gale: 300,
  ember: 400
};

// The silly bits: faces and body decorations worn on top of the hero's sprite.
// Owned ones can be worn and taken off freely, and several can be worn at once.
export const META_ACCESSORIES = [
  {
    key: 'shades',
    name: '黑帮墨镜',
    icon: 'crosshair',
    desc: '脸上横一副黑色墨镜，谁都不服',
    cost: 120
  },
  {
    key: 'mustache',
    name: '滑稽胡子',
    icon: 'swords',
    desc: '嘴下两撇翘起来的八字胡',
    cost: 100
  },
  {
    key: 'tophat',
    name: '高礼帽',
    icon: 'crown',
    desc: '头顶一顶带帽檐的黑色高礼帽',
    cost: 160
  },
  {
    key: 'cybereyes',
    name: '赛博发光眼',
    icon: 'target',
    desc: '眼睛换成一对红色发光点',
    cost: 180
  },
  {
    key: 'halo',
    name: '发光光环',
    icon: 'sparkles',
    desc: '脚底踩一圈青色光环',
    cost: 200
  },
  {
    key: 'tattoo',
    name: '赛博纹身',
    icon: 'zap',
    desc: '身上散着几个青色发光像素点',
    cost: 150
  }
];

function blank() {
  return {
    shards: 0,
    perks: { health: 0, damage: 0, speed: 0 },
    characters: [],
    skins: ['default'],
    skin: 'default',
    accessories: [],
    worn: []
  };
}

export function loadMeta() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blank();

    const data = JSON.parse(raw);
    const base = blank();

    return {
      shards: Math.max(0, Math.floor(Number(data.shards) || 0)),
      perks: { ...base.perks, ...(data.perks || {}) },
      characters: Array.isArray(data.characters) ? data.characters : [],
      skins:
        Array.isArray(data.skins) && data.skins.length > 0
          ? data.skins
          : base.skins,
      skin: typeof data.skin === 'string' ? data.skin : base.skin,
      accessories: Array.isArray(data.accessories) ? data.accessories : [],
      worn: Array.isArray(data.worn) ? data.worn : []
    };
  } catch (error) {
    return blank();
  }
}

export function saveMeta(meta) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(meta));
  } catch (error) {
    // No storage: the meta layer just will not survive a reload.
  }
}

/// What a run of this depth pays out, in star dust.
export function shardsForRun(wave) {
  const w = Math.max(1, Math.floor(wave || 0));
  return Math.max(1, Math.round(w * 2));
}

export function addShards(amount) {
  const meta = loadMeta();
  meta.shards = Math.max(0, meta.shards + Math.floor(amount || 0));
  saveMeta(meta);
  return meta.shards;
}

export function perkLevel(meta, key) {
  const source = meta || loadMeta();
  return Math.max(0, Math.floor(source.perks[key] || 0));
}

/// The starting bonuses every run gets from the permanent perks.
export function metaBonuses() {
  const meta = loadMeta();

  const healthPerk = META_PERKS.find((perk) => perk.key === 'health');
  const damagePerk = META_PERKS.find((perk) => perk.key === 'damage');
  const speedPerk = META_PERKS.find((perk) => perk.key === 'speed');

  return {
    health: perkLevel(meta, 'health') * (healthPerk ? healthPerk.value : 10),
    damage: 1 + perkLevel(meta, 'damage') * (damagePerk ? damagePerk.value : 0.05),
    speed: 1 + perkLevel(meta, 'speed') * (speedPerk ? speedPerk.value : 0.04)
  };
}

/// Buys the next level of a perk. Returns the price paid, or 0.
export function buyPerk(key) {
  const def = META_PERKS.find((perk) => perk.key === key);
  if (!def) return 0;

  const meta = loadMeta();
  const level = perkLevel(meta, key);
  if (level >= def.max) return 0;

  const price = def.cost(level);
  if (meta.shards < price) return 0;

  meta.shards -= price;
  meta.perks[key] = level + 1;
  saveMeta(meta);
  return price;
}

/// Buys a locked character with star dust. Returns the price paid, or 0.
export function buyCharacter(key) {
  const cost = META_CHARACTER_COSTS[key];
  if (!cost) return 0;

  const meta = loadMeta();
  if (meta.characters.indexOf(key) !== -1) return 0;
  if (meta.shards < cost) return 0;

  meta.shards -= cost;
  meta.characters.push(key);
  saveMeta(meta);
  return cost;
}

export function metaCharacterUnlocked(key) {
  return loadMeta().characters.indexOf(key) !== -1;
}

/// Buys a tint and equips it straight away. Returns the price paid, or 0.
export function buySkin(key) {
  const def = META_SKINS.find((skin) => skin.key === key);
  if (!def) return 0;

  const meta = loadMeta();
  if (meta.skins.indexOf(key) !== -1) return 0;
  if (meta.shards < def.cost) return 0;

  meta.shards -= def.cost;
  meta.skins.push(key);
  meta.skin = key;
  saveMeta(meta);
  return def.cost;
}

export function equipSkin(key) {
  const meta = loadMeta();
  if (meta.skins.indexOf(key) === -1) return false;

  meta.skin = key;
  saveMeta(meta);
  return true;
}

/// The tint the player sprite wears this run, or null for the original colours.
export function activeSkinTint() {
  const meta = loadMeta();
  const def = META_SKINS.find((skin) => skin.key === meta.skin);
  return def ? def.tint : null;
}

/// Buys an accessory and wears it straight away. Returns the price paid, or 0.
export function buyAccessory(key) {
  const def = META_ACCESSORIES.find((item) => item.key === key);
  if (!def) return 0;

  const meta = loadMeta();
  if (meta.accessories.indexOf(key) !== -1) return 0;
  if (meta.shards < def.cost) return 0;

  meta.shards -= def.cost;
  meta.accessories.push(key);
  if (meta.worn.indexOf(key) === -1) meta.worn.push(key);
  saveMeta(meta);
  return def.cost;
}

/// Wears or takes off an owned accessory. Returns true when it is now worn.
export function toggleAccessory(key) {
  const meta = loadMeta();
  if (meta.accessories.indexOf(key) === -1) return false;

  const at = meta.worn.indexOf(key);
  if (at === -1) meta.worn.push(key);
  else meta.worn.splice(at, 1);

  saveMeta(meta);
  return at === -1;
}

export function accessoryOwned(key) {
  return loadMeta().accessories.indexOf(key) !== -1;
}

/// The accessories the hero is wearing this run.
export function wornAccessories() {
  return loadMeta().worn.slice();
}
