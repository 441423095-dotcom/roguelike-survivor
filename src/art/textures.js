// Builds every texture the game uses once, at boot, so scenes can just ask for
// them by key.

import { renderPixelArt } from './pixel.js';
import {
  HERO,
  MONSTER,
  FX,
  FLOOR,
  ELITE,
  ORB,
  BOSS,
  COIN,
  PELLET,
  LANCE,
  CRATE,
  IRON,
  SPARK,
  GALE,
  EMBER,
  MOUSE,
  DART,
  SLUG,
  BEAM,
  ROCKET,
  ICE,
  SPIKE,
  DISC,
  EVO,
  SPRINTER,
  TURRET
} from './palette.js';
import {
  HERO_PIXELS,
  HERO_IRON_PIXELS,
  HERO_SPARK_PIXELS,
  HERO_GALE_PIXELS,
  HERO_EMBER_PIXELS,
  GRUNT_PIXELS,
  RUSHER_PIXELS,
  BRUTE_PIXELS,
  CASTER_PIXELS,
  ELITE_PIXELS,
  BOSS_PIXELS,
  MOUSE_PIXELS,
  SPRINTER_PIXELS,
  TURRET_PIXELS,
  BULLET_PIXELS,
  GEM_PIXELS,
  ORB_PIXELS,
  COIN_PIXELS,
  CRATE_PIXELS,
  buildFloorPixels
} from './sprites.js';

export function buildTextures(scene) {
  // Canvas sizes follow the matrices: hero/grunt/caster 42px and under, rusher
  // 36px, brute 60px, elite 80px, boss 120px, bullet and gem 16px, floor tile
  // 32px. Bodies are sized to match in GameScene and src/game/enemies.js.
  renderPixelArt(scene, 'hero', HERO_PIXELS, HERO, 3);
  renderPixelArt(scene, 'hero-iron', HERO_IRON_PIXELS, IRON, 3);
  renderPixelArt(scene, 'hero-spark', HERO_SPARK_PIXELS, SPARK, 3);
  renderPixelArt(scene, 'hero-gale', HERO_GALE_PIXELS, GALE, 3);
  renderPixelArt(scene, 'hero-ember', HERO_EMBER_PIXELS, EMBER, 3);
  renderPixelArt(scene, 'grunt', GRUNT_PIXELS, MONSTER, 3);
  renderPixelArt(scene, 'rusher', RUSHER_PIXELS, MONSTER, 3);
  renderPixelArt(scene, 'brute', BRUTE_PIXELS, MONSTER, 3);
  renderPixelArt(scene, 'caster', CASTER_PIXELS, MONSTER, 3);
  renderPixelArt(scene, 'sprinter', SPRINTER_PIXELS, SPRINTER, 3);
  renderPixelArt(scene, 'turret', TURRET_PIXELS, TURRET, 2);
  renderPixelArt(scene, 'mouse', MOUSE_PIXELS, MOUSE, 2);
  renderPixelArt(scene, 'elite', ELITE_PIXELS, ELITE, 4);
  renderPixelArt(scene, 'boss', BOSS_PIXELS, BOSS, 5);
  renderPixelArt(scene, 'bullet', BULLET_PIXELS, FX, 2);
  renderPixelArt(scene, 'pellet', BULLET_PIXELS, PELLET, 2);
  renderPixelArt(scene, 'lance', BULLET_PIXELS, LANCE, 2);
  renderPixelArt(scene, 'dart', BULLET_PIXELS, DART, 2);
  renderPixelArt(scene, 'slug', BULLET_PIXELS, SLUG, 3);
  renderPixelArt(scene, 'beam', BULLET_PIXELS, BEAM, 3);
  renderPixelArt(scene, 'rocket', BULLET_PIXELS, ROCKET, 3);
  renderPixelArt(scene, 'ice', BULLET_PIXELS, ICE, 2);
  renderPixelArt(scene, 'spike', GEM_PIXELS, SPIKE, 2);
  renderPixelArt(scene, 'disc', ORB_PIXELS, DISC, 2);
  renderPixelArt(scene, 'evo', BULLET_PIXELS, EVO, 3);
  renderPixelArt(scene, 'orb', ORB_PIXELS, ORB, 3);
  renderPixelArt(scene, 'gem', GEM_PIXELS, FX, 2);
  renderPixelArt(scene, 'coin', COIN_PIXELS, COIN, 2);
  renderPixelArt(scene, 'crate', CRATE_PIXELS, CRATE, 3);
  renderPixelArt(scene, 'floor', buildFloorPixels(), FLOOR, 2);
}
