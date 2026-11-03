// The game's cast, drawn as pixel matrices. Each row is a string of palette
// indices; `sym` mirrors the half you write so every sprite stays symmetric.

import { sym } from './pixel.js';

// The hero: a round potato-ish survivor with two bright eyes.
export const HERO_PIXELS = sym(
  '0000000',
  '0000011',
  '0001333',
  '0013444',
  '0134444',
  '0134554',
  '0134464',
  '0134444',
  '0134444',
  '0013444',
  '0011333',
  '0001333',
  '0000111',
  '0000000'
);

// Grunt: a lumpy purple thing with red eyes. The workhorse of every wave.
export const GRUNT_PIXELS = sym(
  '0000000',
  '0000001',
  '0000011',
  '0000133',
  '0001333',
  '0013344',
  '0134454',
  '0134454',
  '0134444',
  '0013344',
  '0001333',
  '0000133',
  '0000011',
  '0000000'
);

// Rusher: thin and crimson, built to close the gap fast.
export const RUSHER_PIXELS = sym(
  '000000',
  '000011',
  '000188',
  '001888',
  '001878',
  '011888',
  '018888',
  '011888',
  '001888',
  '000188',
  '000011',
  '000000'
);

// Brute: a slow, wide wall of dark hide with two red eyes.
export const BRUTE_PIXELS = sym(
  '1100000000',
  '1110000000',
  '1111000000',
  '0111300000',
  '0011330000',
  '0001333000',
  '0001333400',
  '0001333440',
  '0001335544',
  '0001335544',
  '0001333444',
  '0001333444',
  '0001333444',
  '0001333344',
  '0000133334',
  '0000133333',
  '0000013333',
  '0000001333',
  '0000000111',
  '0000000000'
);

// Caster: a hooded shooter in pale robes. Tall and pointed, so its silhouette
// says "stays back and fires" from across the arena.
export const CASTER_PIXELS = sym(
  '0000000',
  '0000000',
  '0000002',
  '0000022',
  '0000222',
  '0002224',
  '0022224',
  '0111111',
  '0014444',
  '0144443',
  '0144377',
  '0144455',
  '0014443',
  '0001444',
  '0000144',
  '0000011'
);

// Elite: a hulking plate-armoured brute with a magenta core. Twice the bulk of
// anything else in the arena.
export const ELITE_PIXELS = sym(
  '1100000000',
  '1110000000',
  '1111000000',
  '0111300000',
  '0011330000',
  '0011334000',
  '0001334400',
  '0001334400',
  '0001334550',
  '0001334550',
  '0001334440',
  '0013334440',
  '0013334440',
  '0001334440',
  '0001333340',
  '0000133334',
  '0000133333',
  '0000013333',
  '0000001111',
  '0000000000'
);

// Boss: a broad hulk with horns reaching in from above and a single wide golden
// eye. Twice the bulk of the elite, so there is never any doubt what walked in.
export const BOSS_PIXELS = sym(
  '000000000000',
  '550000000000',
  '555000000000',
  '055500000000',
  '005550000000',
  '000555000000',
  '000055500000',
  '000005550000',
  '000000555500',
  '000000111110',
  '000011333310',
  '001133333331',
  '011333333333',
  '133333333333',
  '133333333333',
  '133333333666',
  '133333333666',
  '133333333333',
  '013333333331',
  '011333333331',
  '001133333310',
  '000113333300',
  '000001111000',
  '000000000000'
);

// 冲撞巨兽: a dark red angular polygon — four spikes, faceted plates and a
// golden slit for an eye. Nothing about it is round.
export const BOSS_CHARGER_PIXELS = sym(
  '000000000000',
  '000005000000',
  '000055500000',
  '000555440000',
  '000555544000',
  '000055544400',
  '000055544430',
  '500055544430',
  '550055544430',
  '555055544430',
  '555555544430',
  '555544444436',
  '555444444436',
  '555544443330',
  '555444433300',
  '055444433300',
  '055444333300',
  '055533333000',
  '005533330000',
  '005553330000',
  '000553300000',
  '000055000000',
  '000003000000',
  '000000000000'
);

// 宝珠首领: a ringed orb, concentric purple bands with a bright halo edge so it
// reads as a floating eye rather than a mob.
export const BOSS_ORB_PIXELS = sym(
  '000000000000',
  '000000000055',
  '000000005533',
  '000000055333',
  '000005533333',
  '000055333333',
  '000553333333',
  '005533333333',
  '005333334333',
  '005533333333',
  '005544444433',
  '055455554443',
  '005544444433',
  '005533333333',
  '005533333333',
  '005533333333',
  '000553333333',
  '000055333333',
  '000005533333',
  '000000553333',
  '000000055333',
  '000000005533',
  '000000000055',
  '000000000000'
);

// Enemy fire: a round magenta orb, clearly not the player's thin teal shard.
export const ORB_PIXELS = sym(
  '0000',
  '0020',
  '0232',
  '2343',
  '2343',
  '0232',
  '0020',
  '0000'
);

// A coin: round, gold, with a bright punch of highlight on one side.
export const COIN_PIXELS = sym(
  '0000',
  '0022',
  '0232',
  '2334',
  '2334',
  '0232',
  '0022',
  '0000'
);

// The other playable characters. Same 14x14 grid as the hero so the physics body
// and the control band layout stay identical; only the silhouette and wardrobe
// change.

// Iron: a broad, plated frame with a glowing visor slit.
export const HERO_IRON_PIXELS = sym(
  '0000000',
  '0011111',
  '0013333',
  '0013333',
  '0134455',
  '0134455',
  '0133333',
  '0013333',
  '0011333',
  '0001333',
  '0001333',
  '0000133',
  '0000111',
  '0000000'
);

// Spark: tall and thin with a crest on top.
export const HERO_SPARK_PIXELS = sym(
  '0000000',
  '0000011',
  '0000114',
  '0001134',
  '0011334',
  '0013344',
  '0133445',
  '0133445',
  '0013344',
  '0013334',
  '0001334',
  '0001333',
  '0000111',
  '0000000'
);

// Gale: sleek, with a bright scarf across the chest.
export const HERO_GALE_PIXELS = sym(
  '0000000',
  '0000111',
  '0001333',
  '0013444',
  '0134445',
  '0134445',
  '0134444',
  '0136666',
  '0013444',
  '0011344',
  '0001334',
  '0000133',
  '0000111',
  '0000000'
);

// Ember: wide shoulders and a glowing visor band.
export const HERO_EMBER_PIXELS = sym(
  '0000000',
  '0011110',
  '0133331',
  '0134444',
  '0134555',
  '0134444',
  '1133333',
  '1133333',
  '0133333',
  '0013333',
  '0011333',
  '0001333',
  '0000111',
  '0000000'
);

// A dropped weapon: a small pale crate, tinted to the weapon's colour in the
// scene so the same art reads as three different guns.
export const CRATE_PIXELS = sym(
  '000000',
  '011110',
  '122221',
  '124421',
  '122221',
  '142241',
  '122221',
  '011110',
  '000000',
  '000000'
);

export const BULLET_PIXELS = sym(
  '0000',
  '0001',
  '0013',
  '0133',
  '0133',
  '0013',
  '0001',
  '0000'
);

export const GEM_PIXELS = sym(
  '0000',
  '0002',
  '0023',
  '0234',
  '0023',
  '0002',
  '0000',
  '0000'
);

// The arena floor: mostly dark with a scatter of lighter chips so the ground
// still reads as a surface while enemies crawl over it.
export function buildFloorPixels() {
  const pixels = [];
  for (let y = 0; y < 16; y++) {
    const row = [];
    for (let x = 0; x < 16; x++) {
      const n = (x * 5 + y * 11 + ((x * y) % 7)) % 19;
      if (n === 3) row.push(3);
      else if (n === 8) row.push(4);
      else if (n < 6) row.push(2);
      else row.push(1);
    }
    pixels.push(row);
  }
  return pixels;
}


// The teapot's mouse: a round little body with two pink ears, seen from above,
// rendered small so it reads as a pest next to the real monsters.
export const MOUSE_PIXELS = sym(
  '0000000',
  '0001100',
  '0011550',
  '0011333',
  '1116333',
  '0113333',
  '0013333',
  '0001334',
  '0000134',
  '0000011',
  '0000000'
);


// Sprinter: a narrow arrowhead of a monster, all forward lean and no bulk.
export const SPRINTER_PIXELS = sym(
  '000000',
  '000001',
  '000011',
  '000133',
  '001344',
  '013445',
  '013445',
  '001344',
  '000133',
  '000011',
  '000001',
  '000000'
);

// The deployable turret, drawn pointing up: a wedged base with a glowing barrel,
// rotated in the scene to aim at whatever is closest.
export const TURRET_PIXELS = sym(
  '0000000',
  '0000110',
  '0000660',
  '0000660',
  '0000110',
  '0011330',
  '0113331',
  '1134441',
  '1134451',
  '0113331',
  '0011110',
  '0000000'
);


// A chunky side-on blaster, used wherever a character needs to be seen holding
// something. Drawn in steel and tinted per owner, so one texture serves them all.
export const GUN_PIXELS = [
  '0001111111000',
  '0112222222110',
  '1223333332211',
  '0001122211000',
  '0000011000000'
];
