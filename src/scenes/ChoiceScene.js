// The upgrade picker, used both on level-up and after a cleared wave. It freezes
// the run behind it and hands the choice back to the game scene when tapped.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';

export class ChoiceScene extends Phaser.Scene {
  constructor() {
    super('Choice');
  }

  init(data) {
    this.kind = (data && data.kind) || 'level';
    this.heading = (data && data.title) || '选择强化';
    this.cards = (data && data.cards) || [];
    this.picked = false;
  }

  create() {
    this.build();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  onResize() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.build();
  }

  build() {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 0.82).setDepth(1);

    const titleY = Math.max(50 * s, H * 0.1);
    this.add
      .text(W / 2, titleY, this.heading, {
        fontFamily: FONT,
        fontSize: `${Math.round(23 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(
        W / 2,
        titleY + 27 * s,
        this.kind === 'wave' ? '清场奖励 · 选一项强化' : '选一项强化，继续战斗',
        {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.dim
        }
      )
      .setOrigin(0.5)
      .setDepth(2);

    const cardW = Math.min(W - 32, 430 * s);
    const gap = Math.round(10 * s);
    const topY = titleY + 54 * s;
    const count = Math.max(1, this.cards.length);
    const availH = H - topY - 22;
    const cardH = Math.max(
      70,
      Math.min(112 * s, (availH - gap * (count - 1)) / count)
    );

    this.cards.forEach((card, index) => {
      const cy = topY + index * (cardH + gap) + cardH / 2;
      this.buildCard(card, W / 2, cy, cardW, cardH, s);
    });

    sharpenText(this);
  }

  buildCard(card, cx, cy, w, h, s) {
    const g = this.add.graphics().setDepth(2);
    const paint = (highlight) => {
      g.clear();
      g.fillStyle(highlight ? 0x1d3a38 : 0x0f1521, 0.97);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
      g.lineStyle(2, highlight ? COLORS.accent : 0x2bd3c4, highlight ? 1 : 0.32);
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    };
    paint(false);

    const iconSize = Math.min(h * 0.46, 40 * s);
    const iconX = cx - w / 2 + 20 * s + iconSize / 2;
    this.add
      .image(iconX, cy, `icon-${card.icon}`)
      .setDisplaySize(iconSize, iconSize)
      .setTint(COLORS.accent)
      .setDepth(3);

    const textX = iconX + iconSize / 2 + 16 * s;
    const wrapWidth = Math.max(60, cx + w / 2 - 16 * s - textX);

    this.add
      .text(textX, cy - h * 0.18, card.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(17 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    this.add
      .text(textX, cy + h * 0.2, card.desc, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: wrapWidth }
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    if (card.level > 1) {
      this.add
        .text(cx + w / 2 - 14 * s, cy, `Lv${card.level}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.goldHex
        })
        .setOrigin(1, 0.5)
        .setDepth(3);
    }

    const zone = this.add.zone(cx, cy, w, h).setInteractive();
    zone.on('pointerdown', () => this.pick(card, paint));
  }

  pick(card, paint) {
    if (this.picked) return;
    this.picked = true;
    haptic('tick');
    paint(true);

    const run = this.scene.get('Game');
    if (run && run.applyUpgrade) run.applyUpgrade(card.key);
    if (this.kind === 'wave' && run && run.startNextWave) run.startNextWave();

    this.time.delayedCall(160, () => {
      this.scene.stop();
      if (run && run.finishChoice) run.finishChoice();
    });
  }
}
