// Entry point: the Phaser game configuration and nothing else. Gameplay lives
// in scenes under src/scenes/.

import { BootScene } from './scenes/BootScene.js';
import { themeValue } from './theme.js';

// On window so the running game can be inspected from outside the module graph.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  backgroundColor: themeValue('--bg'),

  scale: {
    // The runtime is a phone-shaped panel that can change size, so the game
    // fills whatever it is given rather than assuming a fixed resolution.
    // Scenes read this.scale.gameSize instead of hardcoding width and height.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  // Arcade physics is set up but idle: gravity is zero until a scene asks for
  // it, so a game that does not need physics pays nothing for it being here.
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },

  input: {
    // Phaser tracks one pointer by default, which silently breaks on-screen
    // controls: holding a direction pad and tapping jump is two fingers down
    // at once, and the second tap would never register.
    activePointers: 3
  },

  scene: [BootScene]
});
