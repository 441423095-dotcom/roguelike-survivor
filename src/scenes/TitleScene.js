// The start screen: the hero, the title and one way into the arena.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { haptic } from '../haptics.js';
import { loadProgress, formatDuration, clearProgress } from '../game/progress.js';
import { initAudio, startMusic } from '../game/audio.js';
import { sharpenText } from '../ui/text.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x070a10);
    this.build();

    initAudio(this);
    startMusic(this, 'menu');

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  onResize() {
    this.rebuild();
  }

  rebuild() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.build();
  }

  build() {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    this.add
      .tileSprite(0, 0, W, H, 'floor')
      .setOrigin(0, 0)
      .setDepth(-20);

    const shade = this.add.graphics().setDepth(-19);
    shade.fillStyle(0x05080d, 0.55);
    shade.fillRect(0, 0, W, H);

    // A soft ring behind the hero, so the eye lands on it first.
    shade.lineStyle(2, 0x2bd3c4, 0.16);
    shade.strokeCircle(W / 2, H * 0.34, Math.min(W, H) * 0.24);
    shade.lineStyle(1, 0x2bd3c4, 0.1);
    shade.strokeCircle(W / 2, H * 0.34, Math.min(W, H) * 0.32);

    const heroSize = Math.min(W * 0.3, 132);
    const hero = this.add
      .image(W / 2, H * 0.3, 'hero')
      .setDisplaySize(heroSize, heroSize)
      .setDepth(1);

    this.tweens.add({
      targets: hero,
      y: hero.y - 10,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    const titleY = H * 0.52;
    this.add
      .text(W / 2, titleY, '肉鸽战斗', {
        fontFamily: FONT,
        fontSize: `${Math.round(34 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setShadow(0, 4, '#04070c', 10, false, true);

    this.add
      .text(W / 2, titleY + 34 * s, '怪潮之中 · 活到最后', {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.accentHex
      })
      .setOrigin(0.5)
      .setDepth(2);

    const btnW = Math.min(W - 80, 240 * s);
    const btnH = Math.round(56 * s);

    makeButton(this, {
      x: W / 2,
      y: H * 0.66,
      width: btnW,
      height: btnH,
      icon: 'play',
      label: '开始战斗',
      fontSize: Math.round(18 * s),
      depth: 2,
      onPress: () => this.startRun()
    });

    this.buildRecords(W, H, s);

    this.add
      .text(W / 2, H * 0.87, '自动射击 · 拖动屏幕任意处移动 · 右下按钮冲刺', {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(W / 2, H * 0.905, '击杀怪物拾取碎片升级 · 活过每一波', {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(2);

    sharpenText(this);
  }

  startRun() {
    haptic('tick');
    this.scene.start('Character');
  }

  /// The archive strip under the start button, plus the (deliberately tucked
  /// away) way to wipe it.
  buildRecords(W, H, s) {
    const progress = loadProgress();
    const y = H * 0.78;
    const panelW = Math.min(W - 44, 360 * s);
    const panelH = Math.round(54 * s);
    const panelX = (W - panelW) / 2;
    const panelY = y - panelH / 2;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0b1018, 0.85);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    g.lineStyle(1, 0x2bd3c4, 0.25);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

    const entries = [
      ['最高波次', `第 ${progress.bestWave} 波`, progress.bestWave > 0],
      ['最多击杀', `${progress.bestKills}`, progress.bestKills > 0],
      ['最长存活', formatDuration(progress.bestTime), progress.bestTime > 0]
    ];

    entries.forEach((entry, index) => {
      const cx = panelX + (panelW / 3) * (index + 0.5);

      this.add
        .text(cx, y - 9 * s, entry[0], {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0.5)
        .setDepth(3);

      this.add
        .text(cx, y + 9 * s, entry[1], {
          fontFamily: FONT,
          fontSize: `${Math.round(14 * s)}px`,
          color: entry[2] ? COLORS.goldHex : COLORS.ink,
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setDepth(3);
    });

    this.clearArmed = false;
    this.clearText = this.add
      .text(W - 18 * s, 30 * s, '清空记录', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(1, 0.5)
      .setDepth(3)
      .setInteractive();

    this.clearText.on('pointerdown', () => this.tapClear());
  }

  /// Wiping is destructive, so the first tap only arms it.
  tapClear() {
    if (!this.clearArmed) {
      this.clearArmed = true;
      this.clearText.setText('再点一次确认清空');
      this.clearText.setColor(COLORS.dangerHex);

      this.time.delayedCall(3200, () => {
        if (!this.clearArmed) return;
        this.clearArmed = false;
        if (this.clearText && this.clearText.active) {
          this.clearText.setText('清空记录');
          this.clearText.setColor(COLORS.dim);
        }
      });
      return;
    }

    this.clearArmed = false;
    clearProgress();
    haptic('impact');
    this.rebuild();
  }
}
