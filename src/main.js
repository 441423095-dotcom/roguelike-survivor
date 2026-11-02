// Entry point: the Phaser game configuration and nothing else. Gameplay lives
// in scenes under src/scenes/.

import { DPR } from './ui/view.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';
import { DifficultyScene } from './scenes/DifficultyScene.js';
import { AchievementScene } from './scenes/AchievementScene.js';
import { BestiaryScene } from './scenes/BestiaryScene.js';
import { MetaShopScene } from './scenes/MetaShopScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { ChoiceScene } from './scenes/ChoiceScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { WeaponScene } from './scenes/WeaponScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

// The panel the canvas fills, in CSS pixels.
function stageSize() {
  const stage = document.getElementById('stage') || document.body;

  return {
    width: Math.max(1, Math.round(stage.clientWidth || window.innerWidth)),
    height: Math.max(1, Math.round(stage.clientHeight || window.innerHeight))
  };
}

// Gives the canvas one canvas pixel per device pixel of the screen. The camera
// of each scene zooms by DPR to match, so the game keeps its own coordinates in
// CSS pixels (see src/ui/view.js) while the picture is drawn at full density.
function fitStage(game) {
  const css = stageSize();
  const width = Math.round(css.width * DPR);
  const height = Math.round(css.height * DPR);
  const size = game.scale.gameSize;

  if (size.width === width && size.height === height) return;

  game.scale.resize(width, height);
}

// On window so the running game can be inspected from outside the module graph.
// The page may have already decided this browser cannot draw (no WebGL), and a
// failed boot should say so instead of leaving a black screen behind.
function startGame() {
  if (window.bootBlocked) return;

  const css = stageSize();

  try {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'stage',
      // The game owns a dark palette of its own, in both light and dark mode.
      backgroundColor: 0x070a10,

      scale: {
        // NONE, because every one of Phaser's own modes works in CSS pixels,
        // which is the mismatch that made the picture soft in the first place.
        // The zoom is the inverse of the density, so the device-pixel canvas is
        // displayed at exactly the size of the panel. Scenes read viewSize()
        // rather than this.scale.gameSize, which is in device pixels.
        mode: Phaser.Scale.NONE,
        zoom: 1 / DPR,
        width: Math.round(css.width * DPR),
        height: Math.round(css.height * DPR),
        autoCenter: Phaser.Scale.NO_CENTER
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
        MetaShopScene,
        GameScene,
        HudScene,
        ShopScene,
        ChoiceScene,
        WeaponScene,
        GameOverScene
      ]
    });

    window.game = game;

    // A rotation, or a browser toolbar sliding away, changes the panel size and
    // Phaser in NONE mode leaves the canvas untouched, so the canvas is refitted
    // here. iOS reports the old size for a moment after a rotation, so the fit
    // runs once more just after.
    const refit = () => fitStage(game);
    window.addEventListener('resize', () => {
      refit();
      setTimeout(refit, 240);
    });
    window.addEventListener('orientationchange', () => {
      refit();
      setTimeout(refit, 240);
    });
  } catch (error) {
    if (window.gameFail) {
      window.gameFail(
        '游戏初始化失败：' + (error && error.message ? error.message : '未知错误')
      );
    }
  }
}

startGame();
