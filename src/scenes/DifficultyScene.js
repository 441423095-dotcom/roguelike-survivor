// The difficulty picker: two cards, what each one multiplies, and the best wave
// reached on it. The choice is remembered for the next run.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { TEXT_RESOLUTION, sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { applyCameraZoom, viewSize } from '../ui/view.js';
import { DIFFICULTIES } from '../game/difficulty.js';
import { loadProgress, selectDifficulty } from '../game/progress.js';
import { startMusic } from '../game/audio.js';

export class DifficultyScene extends Phaser.Scene {
  constructor() {
    super('Difficulty');
  }

  create() {
    applyCameraZoom(this);
    startMusic(this, 'menu');
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
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    const progress = loadProgress();

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 1).setDepth(0);

    const titleY = Math.max(48 * s, H * 0.11);

    this.add
      .text(W / 2, titleY, '选择难度', {
        fontFamily: FONT,
        fontSize: `${Math.round(25 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(W / 2, titleY + 27 * s, '两种难度的记录分开保存', {
        fontFamily: FONT,
        fontSize: `${Math.round(12 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(2);

    const cardW = Math.min(W - 32, 430 * s);
    const cardH = Math.max(88, Math.round(Math.min(108 * s, H * 0.17)));
    const gap = Math.round(14 * s);
    const blockH = cardH * 2 + gap;
    const startY = Math.max(titleY + 74 * s, (H - blockH) / 2 - 16 * s);

    DIFFICULTIES.forEach((def, index) => {
      const cy = startY + index * (cardH + gap) + cardH / 2;
      this.buildCard(def, progress, W / 2, cy, cardW, cardH, s);
    });

    makeButton(this, {
      x: W / 2,
      y: H - 52 * s,
      width: Math.min(W - 60, 210 * s),
      height: Math.round(40 * s),
      icon: 'chevron-left',
      label: '返回',
      fontSize: Math.round(14 * s),
      accent: 0x2bd3c4,
      depth: 3,
      onPress: () => this.goBack()
    });

    sharpenText(this);
  }

  buildCard(def, progress, cx, cy, w, h, s) {
    const selected = progress.difficulty === def.key;
    const best = progress.bests[def.key] || { wave: 0 };

    const card = this.add.graphics().setDepth(2);
    card.fillStyle(0x0f1521, 0.97);
    card.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    card.lineStyle(2, selected ? 0xffd166 : def.color, selected ? 0.95 : 0.45);
    card.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);

    const iconX = cx - w / 2 + 34 * s;
    const radius = Math.min(h * 0.26, 20 * s);

    const disc = this.add.circle(iconX, cy, radius, 0x141c28).setDepth(3);
    disc.setStrokeStyle(2, def.color, 0.85);

    this.add
      .image(iconX, cy, `icon-${def.icon}`)
      .setDisplaySize(radius * 1.1, radius * 1.1)
      .setTint(def.color)
      .setDepth(4);

    const textX = cx - w / 2 + 66 * s;

    this.add
      .text(textX, cy - h * 0.26, def.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(18 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    const multipliers = this.add
      .text(
        textX,
        cy - h * 0.02,
        `怪物血量 ×${def.hp} · 伤害 ×${def.damage} · 金币 ×${def.coin}`,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: def.hex
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(3);
    multipliers.setResolution(TEXT_RESOLUTION);

    const desc = this.add
      .text(textX, cy + h * 0.24, def.desc, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: Math.max(80, w - 66 * s - 96 * s) }
      })
      .setOrigin(0, 0.5)
      .setDepth(3);
    desc.setResolution(TEXT_RESOLUTION);

    const bestLabel = this.add
      .text(
        cx + w / 2 - 14 * s,
        cy - h * 0.24,
        best.wave > 0 ? `最好：第 ${best.wave} 波` : '最好：暂无记录',
        {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: best.wave > 0 ? COLORS.goldHex : COLORS.dim
        }
      )
      .setOrigin(1, 0.5)
      .setDepth(3);
    bestLabel.setResolution(TEXT_RESOLUTION);

    if (selected) {
      const tag = this.add
        .text(cx + w / 2 - 14 * s, cy + h * 0.22, '上次选择', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.goldHex
        })
        .setOrigin(1, 0.5)
        .setDepth(3);
      tag.setResolution(TEXT_RESOLUTION);
    }

    const zone = this.add.zone(cx, cy, w, h).setInteractive();
    zone.on('pointerdown', () => this.choose(def.key));
  }

  choose(key) {
    haptic('tick');
    selectDifficulty(key);
    this.scene.start('Character');
  }

  goBack() {
    haptic('tick');
    this.scene.start('Title');
  }
}
