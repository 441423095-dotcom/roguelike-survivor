// The starting screen. Replace it with your game.
//
// A scene is the unit of a Phaser game: preload() loads its assets, create()
// builds the objects, update(time, delta) runs once per frame. Add more scenes
// under src/scenes/ and list them in main.js.

import { themeValue, themeColor, onThemeChange } from '../theme.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.title = this.add
      .text(0, 0, 'Ready to build.', {
        fontFamily: '-apple-system, system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: '600'
      })
      .setOrigin(0.5);

    this.subtitle = this.add
      .text(0, 0, 'Ask for anything to see this change.', {
        fontFamily: '-apple-system, system-ui, sans-serif',
        fontSize: '14px'
      })
      .setOrigin(0.5);

    this.applyTheme();
    onThemeChange(() => this.applyTheme());

    // RESIZE mode means the canvas follows the panel, so anything positioned
    // from the screen size has to be repositioned when that size changes.
    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    // The camera does not follow the canvas on its own under RESIZE.
    this.cameras.resize(width, height);

    this.title.setPosition(width / 2, height / 2 - 12);
    this.subtitle.setPosition(width / 2, height / 2 + 16);
  }

  applyTheme() {
    this.cameras.main.setBackgroundColor(themeColor('--bg'));
    this.title.setColor(themeValue('--fg'));
    this.subtitle.setColor(themeValue('--muted'));
  }
}
