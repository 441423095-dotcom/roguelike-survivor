// Weapons. The player carries at most three at once and each one auto-fires on
// its own cooldown at the nearest enemy in its own range.
//
// Every gun belongs to a style — bullets, energy, explosives or blades — which
// shop items can boost, so a run drifts into an archetype instead of being a
// pile of unrelated numbers.
//
// Level-up cards raise the global damage / rate / range figures that every
// weapon scales from, so a weapon's numbers are always derived here rather than
// stored twice.

import { rarityBonus } from './rarities.js';

export const WEAPON_SLOTS = 5;

// The figures a fresh run starts with. Every upgrade multiplies these, and the
// ratios are applied to each weapon's own base below.
export const BASE_STATS = {
  damage: 12,
  fireInterval: 460,
  projectiles: 1,
  range: 300,
  bulletSpeed: 480
};

export const WEAPONS = {
  blaster: {
    key: 'blaster',
    name: '手炮',
    emoji: '🔫',
    style: 'bullet',
    texture: 'bullet',
    note: '基础 14 伤害，射速均衡的起手枪',
    color: 0x39e6cd,
    interval: 460,
    damage: 14,
    speed: 480,
    range: 300,
    count: 1,
    spread: 0.15,
    bodyRadius: 5,
    bodyOffset: 3
  },
  shotgun: {
    key: 'shotgun',
    name: '散弹枪',
    emoji: '💥',
    style: 'bullet',
    texture: 'pellet',
    note: '三连霰弹，每颗 7 伤害，贴脸最痛',
    color: 0xffb038,
    interval: 820,
    damage: 7,
    speed: 430,
    range: 230,
    count: 3,
    spread: 0.3,
    bodyRadius: 4,
    bodyOffset: 4
  },
  piercer: {
    key: 'piercer',
    name: '穿透枪',
    emoji: '🎯',
    style: 'energy',
    texture: 'lance',
    note: '单发 18 伤害，一枪穿透 2 个敌人',
    color: 0xc86bff,
    interval: 640,
    damage: 18,
    speed: 640,
    range: 360,
    count: 1,
    spread: 0.1,
    pierce: 2,
    bodyRadius: 5,
    bodyOffset: 3
  },
  smg: {
    key: 'smg',
    name: '冲锋枪',
    emoji: '💨',
    style: 'bullet',
    texture: 'dart',
    note: '0.18 秒一发的速射，单发 6 伤害',
    color: 0x8ef0b0,
    interval: 180,
    damage: 6,
    speed: 560,
    range: 250,
    count: 1,
    spread: 0.2,
    bodyRadius: 4,
    bodyOffset: 4
  },
  sniper: {
    key: 'sniper',
    name: '狙击枪',
    emoji: '🔭',
    texture: 'slug',
    style: 'energy',
    note: '单发 55 伤害的远程狙击，还能穿 1 个敌人',
    color: 0x9fb3c4,
    interval: 1250,
    damage: 55,
    speed: 960,
    range: 470,
    count: 1,
    spread: 0,
    pierce: 1,
    bodyRadius: 7,
    bodyOffset: 5
  },
  laser: {
    key: 'laser',
    name: '激光枪',
    emoji: '⚡',
    texture: 'beam',
    color: 0x63ffe0,
    style: 'energy',
    note: '单发 11 伤害的光束，连穿 3 个敌人',
    interval: 700,
    damage: 11,
    speed: 820,
    range: 380,
    count: 1,
    spread: 0.05,
    pierce: 3,
    bodyRadius: 6,
    bodyOffset: 6
  },
  rocket: {
    key: 'rocket',
    name: '火箭炮',
    emoji: '🚀',
    texture: 'rocket',
    color: 0xff7a1f,
    style: 'explosive',
    note: '单发 34 伤害，落点炸开一片',
    interval: 1500,
    damage: 34,
    speed: 380,
    range: 400,
    count: 1,
    spread: 0,
    splash: 70,
    bodyRadius: 8,
    bodyOffset: 4
  },
  frost: {
    key: 'frost',
    name: '冰霜枪',
    emoji: '❄️',
    texture: 'ice',
    color: 0x9ce6ff,
    style: 'energy',
    note: '单发 8 伤害，命中让敌人减速 45%',
    interval: 600,
    damage: 8,
    speed: 460,
    range: 300,
    count: 1,
    spread: 0.12,
    slow: 0.45,
    bodyRadius: 5,
    bodyOffset: 3
  },
  venom: {
    key: 'venom',
    name: '毒针枪',
    emoji: '🐍',
    texture: 'spike',
    color: 0x7fe36b,
    style: 'bullet',
    note: '双发 5 伤害毒针，附带减速',
    interval: 420,
    damage: 5,
    speed: 520,
    range: 270,
    count: 2,
    spread: 0.35,
    slow: 0.25,
    bodyRadius: 5,
    bodyOffset: 3
  },
  disc: {
    key: 'disc',
    name: '回旋镖',
    emoji: '🪃',
    texture: 'disc',
    color: 0xd9a8ff,
    style: 'blade',
    behaviour: 'boomerang',
    note: '14 伤害的回旋镖，来回穿过 4 个敌人',
    interval: 900,
    damage: 14,
    speed: 560,
    range: 260,
    count: 1,
    spread: 0.9,
    pierce: 4,
    bodyRadius: 6,
    bodyOffset: 2
  },
  pan: {
    key: 'pan',
    name: '平底锅',
    emoji: '🍳',
    texture: 'bullet',
    color: 0xc9d6e2,
    style: 'blade',
    behaviour: 'swing',
    note: '近身横扫 26 伤害，把敌人打飞',
    interval: 720,
    damage: 26,
    speed: 0,
    range: 118,
    count: 1,
    spread: 0,
    bodyRadius: 5,
    bodyOffset: 3
  },
  knife: {
    key: 'knife',
    name: '飞刀',
    emoji: '🔪',
    texture: 'dart',
    color: 0xe8f4ff,
    style: 'blade',
    note: '飞刀 8 伤害，能穿过 3 个敌人',
    interval: 330,
    damage: 8,
    speed: 780,
    range: 400,
    count: 1,
    spread: 0.05,
    pierce: 3,
    bodyRadius: 4,
    bodyOffset: 4
  },
  cactus: {
    key: 'cactus',
    name: '仙人掌',
    emoji: '🌵',
    texture: 'bullet',
    color: 0x7fe36b,
    style: 'blade',
    behaviour: 'cactus',
    note: '插在地上持续扎人，每次 14 伤害',
    interval: 3200,
    damage: 14,
    speed: 0,
    range: 60,
    count: 1,
    spread: 0,
    bodyRadius: 5,
    bodyOffset: 3
  },
  staff: {
    key: 'staff',
    name: '闪电法杖',
    emoji: '🪄',
    texture: 'beam',
    color: 0xffe066,
    style: 'energy',
    behaviour: 'smite',
    note: '每 2.2 秒随机劈 3 个敌人，每个 20 伤害',
    interval: 2200,
    damage: 20,
    speed: 0,
    range: 520,
    count: 3,
    spread: 0,
    bodyRadius: 5,
    bodyOffset: 3
  },
  mushroom: {
    key: 'mushroom',
    name: '毒液蘑菇',
    emoji: '🍄',
    texture: 'spike',
    color: 0x9be564,
    style: 'bullet',
    behaviour: 'puddle',
    note: '脚边留一滩毒液，踩上去每次掉 7 点血',
    interval: 2600,
    damage: 7,
    speed: 0,
    range: 200,
    count: 1,
    spread: 0,
    bodyRadius: 5,
    bodyOffset: 3
  },

  // ---------------------------------------------------- late-run artillery
  void: {
    key: 'void',
    name: '虚空炮',
    emoji: '🌌',
    style: 'energy',
    texture: 'evo',
    color: 0xb07bff,
    note: '一发 48 伤害，穿透 4 个敌人并炸开',
    interval: 1100,
    damage: 48,
    speed: 560,
    range: 430,
    count: 1,
    spread: 0,
    pierce: 4,
    splash: 40,
    bodyRadius: 7,
    bodyOffset: 4
  },
  plasma: {
    key: 'plasma',
    name: '等离子散射',
    emoji: '🔆',
    style: 'energy',
    texture: 'beam',
    color: 0x63ffe0,
    note: '三股 26 伤害射线，各穿透 2 个敌人',
    interval: 900,
    damage: 26,
    speed: 700,
    range: 380,
    count: 3,
    spread: 0.22,
    pierce: 2,
    bodyRadius: 6,
    bodyOffset: 3
  },
  rail: {
    key: 'rail',
    name: '轨道炮',
    emoji: '🛤️',
    style: 'energy',
    texture: 'slug',
    color: 0xe8f4ff,
    note: '一发 92 伤害，极慢但能穿透整条队伍',
    interval: 1600,
    damage: 92,
    speed: 1250,
    range: 560,
    count: 1,
    spread: 0,
    pierce: 6,
    bodyRadius: 8,
    bodyOffset: 4
  },
  storm: {
    key: 'storm',
    name: '雷暴发射器',
    emoji: '🌩️',
    style: 'explosive',
    texture: 'rocket',
    color: 0xffd166,
    note: '两发 38 伤害炮弹，落点炸开一片',
    interval: 1400,
    damage: 38,
    speed: 420,
    range: 430,
    count: 2,
    spread: 0.24,
    splash: 85,
    bodyRadius: 8,
    bodyOffset: 4
  }
};

export const WEAPON_KEYS = Object.keys(WEAPONS);

// A merged gun takes its name from the pair that made it.
const EVOLUTIONS = {
  'blaster+shotgun': { name: '霰射手炮', emoji: '💥', style: 'bullet' },
  'piercer+shotgun': { name: '裂空散弹', emoji: '🎯', style: 'energy' },
  'laser+smg': { name: '光束风暴', emoji: '⚡', style: 'energy' },
  'piercer+sniper': { name: '穿甲狙击', emoji: '🔭', style: 'energy' },
  'frost+rocket': { name: '冰爆火箭', emoji: '🚀', style: 'explosive' },
  'frost+venom': { name: '剧毒冰霜', emoji: '🐍', style: 'energy' },
  'disc+laser': { name: '回旋光刃', emoji: '🪃', style: 'blade' }
};

/// The definition for a carried weapon — an evolved gun keeps its own def on the
/// slot, everything else is looked up by key.
export function weaponDef(slot) {
  if (!slot) return null;
  return slot.def || WEAPONS[slot.key] || null;
}

/// Two level-3 guns can be welded into one: bigger, faster and both of the parts
/// rolled into a single slot.
export function evolvedWeapon(a, b) {
  const da = weaponDef(a);
  const db = weaponDef(b);
  if (!da || !db) return null;

  const pair = `${a.key}+${b.key}`;
  const reverse = `${b.key}+${a.key}`;
  const recipe = EVOLUTIONS[pair] || EVOLUTIONS[reverse];

  return {
    key: `evo:${pair}`,
    name: recipe ? recipe.name : `${da.name}·改`,
    emoji: recipe ? recipe.emoji : '🌟',
    style: recipe ? recipe.style : da.style || 'bullet',
    texture: 'evo',
    color: 0xffd166,
    interval: Math.max(120, Math.min(da.interval, db.interval) * 0.78),
    damage: Math.max(da.damage, db.damage) * 1.6,
    speed: Math.max(da.speed, db.speed) * 1.15,
    range: Math.max(da.range, db.range) * 1.1,
    count: Math.max(da.count, db.count) + 1,
    spread: Math.max(da.spread, db.spread),
    pierce: (da.pierce || 0) + (db.pierce || 0) + 1,
    splash: Math.max(da.splash || 0, db.splash || 0),
    slow: Math.max(da.slow || 0, db.slow || 0),
    bodyRadius: 7,
    bodyOffset: 5,
    evolved: true
  };
}

/// A weapon's live numbers: its own base, lifted by its own levels, then scaled
/// by the run-wide upgrades, by the item bonuses to its style and by how many
/// guns are carried at once.
export function weaponStats(slot, state) {
  const def = weaponDef(slot);
  if (!def) return null;

  const level = Math.max(1, slot.level || 1);
  const levelDamage = 1 + 0.2 * (level - 1);
  const levelRate = Math.max(0.5, 1 - 0.08 * (level - 1));

  const styleBonus = (state.styleBonus && state.styleBonus[def.style]) || 1;
  const synergy = 1 + (state.weaponSynergy || 0) * Math.max(0, carries(state) - 1);
  const rarity = rarityBonus(slot.rarity);

  return {
    def,
    damage:
      def.damage *
      levelDamage *
      (state.damage / BASE_STATS.damage) *
      styleBonus *
      synergy *
      rarity.damage,
    interval: Math.max(
      80,
      def.interval * levelRate * (state.fireInterval / BASE_STATS.fireInterval)
    ),
    count:
      def.count +
      Math.max(0, state.projectiles - BASE_STATS.projectiles) +
      rarity.projectiles,
    spread: def.spread,
    speed: def.speed * (state.bulletSpeed / BASE_STATS.bulletSpeed),
    range: def.range * (state.range / BASE_STATS.range),
    pierce: (def.pierce || 0) + (level >= 3 ? 1 : 0) + rarity.pierce,
    slow: def.slow || 0,
    splash: (def.splash || 0) + (state.splashBonus || 0) + rarity.splash,
    behaviour: def.behaviour || 'gun'
  };
}

function carries(state) {
  return state.weapons ? state.weapons.length : 1;
}
