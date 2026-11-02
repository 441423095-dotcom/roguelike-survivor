// First scene: builds every texture the game draws and registers the icons it
// needs, then hands over to the title screen. Everything here is synchronous —
// the sprites are drawn in code, so there are no files to load.

import { buildTextures } from '../art/textures.js';
import { registerIcons } from '../icons.js';
import { initAudio } from '../game/audio.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildTextures(this);
    initAudio(this);

    registerIcons(this, [
      'play',
      'pause',
      'rotate-ccw',
      'chevrons-right',
      'chevron-left',
      'heart',
      'swords',
      'gauge',
      'sparkles',
      'footprints',
      'target',
      'magnet',
      'shield',
      'crosshair',
      'arrow-right',
      'zap',
      'lock',
      'medal',
      'check',
      'flag',
      'skull',
      'users',
      'layers',
      'crown',
      'coins',
      'infinity',
      'book-open'
    ]);

    this.scene.start('Title');
  }
}
