// Enemy kinds and how a wave mixes them. Radii and offsets line up with the
// texture sizes built in src/art/textures.js (grunt/caster 42px, rusher 36px,
// brute 60px, elite 80px) so the physics circle always sits in the middle of
// the sprite.
//
// `behaviour` drives the AI in GameScene: 'chase' walks straight at the player,
// 'ranged' keeps its distance and fires orbs.

export const ENEMY_TYPES = {
  grunt: {
    texture: 'grunt',
    hp: 12,
    speed: 70,
    damage: 12,
    radius: 12,
    offset: 9,
    xp: 1,
    coins: 1,
    coinChance: 0.35,
    weaponChance: 0.03,
    color: 0xa884d0,
    behaviour: 'chase'
  },
  rusher: {
    texture: 'rusher',
    hp: 7,
    speed: 138,
    damage: 9,
    radius: 10,
    offset: 8,
    xp: 2,
    coins: 1,
    coinChance: 0.35,
    weaponChance: 0.03,
    color: 0xff5a72,
    behaviour: 'chase'
  },
  brute: {
    texture: 'brute',
    hp: 52,
    speed: 56,
    damage: 24,
    radius: 20,
    offset: 10,
    xp: 6,
    coins: 2,
    coinChance: 0.8,
    weaponChance: 0.15,
    color: 0x8f1f33,
    behaviour: 'chase'
  },
  caster: {
    texture: 'caster',
    hp: 26,
    speed: 66,
    damage: 10,
    radius: 12,
    offsetX: 9,
    offsetY: 12,
    xp: 3,
    coins: 1,
    coinChance: 0.45,
    weaponChance: 0.05,
    color: 0xc9a6ff,
    behaviour: 'ranged',
    keepNear: 150,
    keepFar: 250,
    shootInterval: 1900,
    shotDamage: 11
  },
  // Sprinter: thin, pale and quick. It ignores everything except the player and
  // is the reason standing still stops being an option.
  sprinter: {
    texture: 'sprinter',
    hp: 8,
    speed: 200,
    damage: 7,
    radius: 10,
    offset: 8,
    xp: 2,
    coins: 1,
    coinChance: 0.3,
    weaponChance: 0.02,
    color: 0x8fd8ff,
    behaviour: 'chase'
  },
  elite: {
    texture: 'elite',
    hp: 85,
    speed: 56,
    damage: 28,
    radius: 28,
    offset: 12,
    xp: 4,
    gems: 3,
    coins: 4,
    coinChance: 1,
    weaponChance: 0.4,
    color: 0xff3d8b,
    behaviour: 'chase',
    aura: 124,
    auraColor: 0xff3d8b
  },
  // 尖叫的茶壶's pest: tiny, very fast, and worth coins to whoever catches it.
  // It never joins a wave — GameScene summons it — so it has no place in the
  // spawn table below.
  mouse: {
    texture: 'mouse',
    hp: 8,
    speed: 250,
    damage: 8,
    radius: 8,
    offsetX: 6,
    offsetY: 3,
    xp: 1,
    gems: 1,
    coins: 3,
    coinChance: 1,
    weaponChance: 0,
    color: 0xf0a05a,
    behaviour: 'chase'
  },
  boss: {
    texture: 'boss',
    hp: 300,
    speed: 62,
    damage: 34,
    radius: 40,
    offset: 20,
    xp: 6,
    gems: 8,
    coins: 12,
    coinChance: 1,
    weaponChance: 1,
    color: 0xff3d6e,
    behaviour: 'boss',
    aura: 190,
    auraColor: 0xff3d6e,
    shotDamage: 16
  }
};

/// Every fifth wave is a boss wave: no spawns, no clock, one huge enemy.
export function isBossWave(wave) {
  return wave % 5 === 0;
}

/// How long a wave lasts, in seconds.
export function waveDuration(wave) {
  return Math.min(20 + wave * 2, 38);
}

/// The whole curve in one place, so the late run cannot drift out of control:
/// health compounds, speed and damage taper off well before they get silly.
export function waveScaling(wave) {
  const w = Math.max(1, wave);

  return {
    hp: Math.pow(1.13, w - 1),
    speed: Math.min(1.7, 1 + (w - 1) * 0.035),
    damage: Math.min(2.4, 1 + (w - 1) * 0.075),
    count: Math.min(90, 34 + w * 3)
  };
}

/// How often a spawn tick fires, how many it drops and how many may be alive.
/// The opening waves are deliberately thin — that is the stretch where the
/// player builds a run — and density only levels off afterwards, so pressure
/// comes from how hard the horde hunts rather than from a wall of bodies.
export function waveSpawnPlan(wave) {
  const w = Math.max(1, wave);

  if (w <= 5) {
    return {
      delay: 1750 - w * 120,
      count: w <= 3 ? 1 : 2,
      cap: 8 + w * 2
    };
  }

  const t = Math.min(1, (w - 5) / 15);
  return {
    delay: Math.round(980 - 220 * t),
    count: Math.min(4, 2 + Math.floor((w - 5) / 4)),
    cap: Math.round(24 + 14 * t)
  };
}

/// Which kinds can show up, and how often. Shooters arrive on wave 3, the fast
/// sprinters start hunting from wave 4, and the first elite stomps in on wave 4.
function tableForWave(wave) {
  const table = [['grunt', 10]];
  if (wave >= 2) table.push(['rusher', wave >= 4 ? 6 : 3]);
  if (wave >= 4) table.push(['sprinter', wave >= 8 ? 5 : 2]);
  if (wave >= 3) table.push(['caster', wave >= 6 ? 3 : 2]);
  if (wave >= 3) table.push(['brute', wave >= 5 ? 4 : 2]);
  if (wave >= 4) table.push(['elite', wave >= 7 ? 3 : 2]);
  return table;
}

/// Picks an enemy kind for this wave, weighted by how deep in the run we are.
export function pickEnemyType(wave) {
  const table = tableForWave(wave);
  let total = 0;
  for (const entry of table) total += entry[1];

  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry[1];
    if (roll <= 0) return entry[0];
  }
  return 'grunt';
}
