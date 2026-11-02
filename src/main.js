// Entry point: the Phaser game configuration and nothing else. Gameplay lives
// in scenes under src/scenes/.

import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';
import { DifficultyScene } from './scenes/DifficultyScene.js';
import { AchievementScene } from './scenes/AchievementScene.js';
import { BestiaryScene } from './scenes/BestiaryScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { ChoiceScene } from './scenes/ChoiceScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { WeaponScene } from './scenes/WeaponScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

// On window so the running game can be inspected from outside the module graph.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  // The game owns a dark palette of its own, in both light and dark mode.
  backgroundColor: 0x070a10,

  scale: {
    // The runtime is a phone-shaped panel that can change size, so the game
    // fills whatever it is given rather than assuming a fixed resolution.
    // Scenes read this.scale.gameSize instead of hardcoding width and height.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  // Arcade physics is idle until a body is given velocity: the arena is flat,
  // so nothing falls. It is here for the collision checks between the player,
  // the enemies and the bullets.
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },

  input: {
    // Phaser tracks one pointer by default, which silently breaks on-screen
    // controls: holding the stick and tapping dash is two fingers down at once,
    // and the second tap would never register.
    activePointers: 3
  },

  // The first scene starts on its own; the rest are added stopped and are
  // launched by the scenes that need them. Order is also draw order.
  scene: [
    BootScene,
    TitleScene,
    CharacterScene,
    DifficultyScene,
    AchievementScene,
    BestiaryScene,
    GameScene,
    HudScene,
    ShopScene,
    ChoiceScene,
    WeaponScene,
    GameOverScene
  ]
});
