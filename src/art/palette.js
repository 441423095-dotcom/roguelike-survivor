// Every colour the game draws lives here, indexed by the numbers written into
// the pixel matrices in src/art/sprites.js. Index 0 is always transparent.

export const HERO = [
  null, // 0 transparent
  0x241a20, // 1 outline
  0x9c5c33, // 2 skin shade
  0xd98b52, // 3 skin
  0xffcf9b, // 4 skin light
  0xffffff, // 5 eye white
  0x1b1320, // 6 pupil
  0xd94b3a, // 7 bandana
  0x7d2a20 // 8 bandana shade
];

export const MONSTER = [
  null,
  0x120e18, // 1 outline
  0x2e2142, // 2 darkest body
  0x6b4a91, // 3 purple body
  0xa884d0, // 4 light purple
  0xff4d6d, // 5 hostile red
  0xff9db0, // 6 pink
  0xffffff, // 7 white
  0x8f1f33 // 8 dark red body
];

export const FX = [
  null,
  0x0d3b3a, // 1 deep teal
  0x1fa89a, // 2 teal
  0x63ffe0, // 3 glow
  0xffffff // 4 white
];

// The elite: pale bone plating and a magenta core, so it never reads as one of
// the purple or crimson rank and file.
export const ELITE = [
  null,
  0x1a1620, // 1 outline
  0x6f6a72, // 2 dark stone
  0xb9b3a6, // 3 stone
  0xe8e2d4, // 4 bone highlight
  0xff3d8b, // 5 magenta core
  0xfff0f5 // 6 white
];

// Enemy fire: a hot orange fireball, deliberately nothing like the pale shards.
export const ORB = [
  null,
  0x2b0600, // 1 dark rim
  0xc2350a, // 2 body
  0xff7a1f, // 3 bright
  0xffe0a8 // 4 hot core
];

// The boss: deep purple hide, magenta horns and one wide golden eye.
export const BOSS = [
  null,
  0x180c20, // 1 outline
  0x3a1650, // 2 deep purple
  0x7b2e94, // 3 purple hide
  0xa94fbd, // 4 light purple
  0xff3d6e, // 5 magenta horns
  0xffd166 // 6 golden eye
];

// 冲撞巨兽: a dark red polygon with hot orange edges and one golden slit for an
// eye, so it never reads as a scaled-up grunt.
export const BOSS_RED = [
  null,
  0x1c0709, // 1 outline
  0x4d0f18, // 2 deep red
  0x8f1e2b, // 3 red hide
  0xd93a34, // 4 bright plate
  0xff8f4d, // 5 hot edge
  0xffe27a // 6 golden eye
];

// 弹幕之眼: a purple orb ringed in lavender light, with the same golden eye.
export const BOSS_ORB = [
  null,
  0x140a20, // 1 outline
  0x2e0f4a, // 2 deep purple
  0x5b1f8f, // 3 purple body
  0x8b3fd0, // 4 light body
  0xc98bff, // 5 halo rim
  0xffe27a // 6 golden eye
];

// Coins: the shop currency, warm gold so it never reads as a shard.
export const COIN = [
  null,
  0x6b4a12, // 1 outline
  0xd99a1f, // 2 gold
  0xffd166, // 3 bright gold
  0xfff1b8 // 4 highlight
];

// Shotgun pellets, warm so a spread reads instantly against the teal blaster.
export const PELLET = [
  null,
  0x3a240a, // 1 outline
  0xd99a1f, // 2 body
  0xffd166, // 3 bright
  0xfff1b8 // 4 highlight
];

// Piercer rounds: violet, long and mean.
export const LANCE = [
  null,
  0x2a1030, // 1 outline
  0x7b2e94, // 2 body
  0xc86bff, // 3 bright
  0xf0d6ff // 4 highlight
];

// Weapon crates are drawn pale so a weapon's colour tint shows clearly on top.
export const CRATE = [
  null,
  0x101418, // 1 outline
  0xffffff, // 2 body (tinted per weapon)
  0xb8c4cc, // 3 shade
  0x7f8c96 // 4 dark strap
];

// Character palettes. Same matrix, different wardrobe and different numbers.
export const IRON = [
  null,
  0x181d24, // 1 outline
  0x4e5a66, // 2 dark steel
  0x8794a1, // 3 steel
  0xc9d6e0, // 4 light steel
  0xffb038, // 5 visor
  0x323c46 // 6 deeper steel
];

export const SPARK = [
  null,
  0x1b1024, // 1 outline
  0x4e2470, // 2 dark violet
  0x8b4ec4, // 3 violet
  0xc79df0, // 4 light violet
  0xffffff, // 5 eye
  0x2a1440 // 6 deep violet
];

export const GALE = [
  null,
  0x0e2118, // 1 outline
  0x2c6444, // 2 dark green
  0x56a478, // 3 green
  0x9ce6b6, // 4 light green
  0xffffff, // 5 eye
  0xd9f75a // 6 scarf
];

export const EMBER = [
  null,
  0x241208, // 1 outline
  0x6f2f14, // 2 dark ember
  0xb9561f, // 3 ember
  0xf0a05a, // 4 light ember
  0xffe066, // 5 visor
  0x8f3a12 // 6 deep ember
];

export const FLOOR = [
  null,
  0x0b0e14, // 1 base
  0x121a26, // 2 speckle
  0x1a2331, // 3 speckle light
  0x263347 // 4 chip
];


// 尖叫的茶壶's pest: a small warm-grey mouse with pink ears and a bright eye.
export const MOUSE = [
  null,
  0x1a1420, // 1 outline
  0x6f6257, // 2 fur shade
  0xa89a8a, // 3 fur
  0xe0d3c2, // 4 fur light
  0xff9db0, // 5 ear pink
  0xff4d6d // 6 eye
];


// Bullets for the rest of the arsenal: each weapon owns one colour so a wall of
// fire is still readable at a glance.
export const DART = [
  null,
  0x0c2e1e, // 1 outline
  0x2f8f5a, // 2 body
  0x8ef0b0, // 3 bright
  0xe6fff0 // 4 highlight
];

export const SLUG = [
  null,
  0x11161c, // 1 outline
  0x5a6b7a, // 2 body
  0x9fb3c4, // 3 bright
  0xffffff // 4 highlight
];

export const BEAM = [
  null,
  0x06303a, // 1 outline
  0x18b8c9, // 2 body
  0x7ff0ff, // 3 bright
  0xffffff // 4 highlight
];

export const ROCKET = [
  null,
  0x2b0600, // 1 outline
  0xc2350a, // 2 body
  0xff7a1f, // 3 bright
  0xffe0a8 // 4 hot core
];

export const ICE = [
  null,
  0x0b2a3a, // 1 outline
  0x2f7fa8, // 2 body
  0x9ce6ff, // 3 bright
  0xffffff // 4 highlight
];

export const SPIKE = [
  null,
  0x10300f, // 1 outline
  0x2f8f2a, // 2 body
  0x7fe36b, // 3 bright
  0xe8ffd6 // 4 highlight
];

export const DISC = [
  null,
  0x2a1030, // 1 outline
  0x7b2e94, // 2 body
  0xd9a8ff, // 3 bright
  0xf7ecff // 4 highlight
];


// Merged weapons fire one shared round: pale gold, bigger than anything else on
// the field, so a finished build is obvious at a glance.
export const EVO = [
  null,
  0x3a2a06, // 1 outline
  0xd99a1f, // 2 body
  0xffd166, // 3 bright
  0xfff8e0 // 4 highlight
];


// The sprinter: a pale, lean shape built for one thing only — closing the gap.
export const SPRINTER = [
  null,
  0x0b2a3a, // 1 outline
  0x2f7fa8, // 2 shade
  0x8fd8ff, // 3 body
  0xd9f4ff, // 4 light
  0xffffff // 5 hot core
];

// The deployable turret: dark steel with a teal ring and a bright barrel.
export const TURRET = [
  null,
  0x0b1018, // 1 outline
  0x1b2634, // 2 dark steel
  0x3a4450, // 3 steel
  0x8fa3b0, // 4 light steel
  0x39e6cd, // 5 teal ring
  0x63ffe0 // 6 barrel glow
];
