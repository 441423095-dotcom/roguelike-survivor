// The achievement archive: every goal, how far along it is, and a check for the
// ones already earned. The list scrolls by dragging it up and down.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { TEXT_RESOLUTION, sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { achievementState, claimReward } from '../game/achievements.js';
import { Sfx } from '../game/audio.js';

export class AchievementScene extends Phaser.Scene {
  constructor() {
    super('Achievement');
  }

  create() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragDistance = 0;
    this.build();

    this.input.on('pointerdown', this.onDragStart, this);
    this.input.on('pointermove', this.onDragMove, this);
    this.input.on('pointerup', this.onDragEnd, this);
    this.input.on('pointerupoutside', this.onDragEnd, this);

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.input.off('pointerdown', this.onDragStart, this);
      this.input.off('pointermove', this.onDragMove, this);
      this.input.off('pointerup', this.onDragEnd, this);
      this.input.off('pointerupoutside', this.onDragEnd, this);
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

    const state = achievementState();

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 1).setDepth(0);

    const titleY = Math.max(46 * s, H * 0.08);

    this.add
      .text(W / 2, titleY, '成就', {
        fontFamily: FONT,
        fontSize: `${Math.round(24 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(W / 2, titleY + 26 * s, `已达成 ${state.done}/${state.total}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    const listTop = titleY + 58 * s;
    const listBottom = H - 78 * s;
    const cardW = Math.min(W - 32, 430 * s);
    const rowH = Math.max(52, Math.round(60 * s));
    const gap = Math.max(6, Math.round(9 * s));

    this.listTop = listTop;
    this.listBottom = listBottom;
    this.rowH = rowH;
    this.rowGap = gap;
    this.rows = [];

    state.items.forEach((item, index) => {
      const row = this.buildRow(item, cardW, rowH, s);
      const claimable = item.done && !item.claimed;

      const zone = this.add
        .zone(W / 2, listTop + index * (rowH + gap) + rowH / 2, cardW, rowH)
        .setDepth(3)
        .setOrigin(0.5);
      zone.setInteractive();

      if (claimable) {
        zone.on('pointerup', () => {
          if (this.dragDistance > 14) return;
          this.claim(item);
        });
      } else if (zone.input) {
        zone.input.enabled = false;
      }

      this.rows.push({ node: row, zone, index, claimable });
    });

    const contentH = state.items.length * (rowH + gap) - gap;
    this.maxScroll = Math.max(0, contentH - (listBottom - listTop));
    this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScroll, 0);
    this.applyScroll();

    if (this.maxScroll > 0) {
      this.add
        .text(W / 2, H - 34 * s, '上下拖动查看全部', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0.5)
        .setDepth(2);
    }

    makeButton(this, {
      x: W / 2,
      y: H - 56 * s,
      width: Math.min(W - 60, 210 * s),
      height: Math.round(40 * s),
      icon: 'chevron-left',
      label: '返回标题',
      fontSize: Math.round(14 * s),
      accent: 0x2bd3c4,
      depth: 3,
      onPress: () => this.goBack()
    });

    sharpenText(this);
  }

  buildRow(item, cardW, rowH, s) {
    const half = cardW / 2;
    const halfH = rowH / 2;

    const card = this.add.graphics();
    card.fillStyle(item.done ? 0x141f18 : 0x0f1521, 0.97);
    card.fillRoundedRect(-half, -halfH, cardW, rowH, 14);
    card.lineStyle(2, item.done ? 0xffd166 : 0x2bd3c4, item.done ? 0.55 : 0.28);
    card.strokeRoundedRect(-half, -halfH, cardW, rowH, 14);

    const iconX = -half + 30 * s;
    const iconR = Math.min(halfH - 6 * s, 16 * s);

    const disc = this.add.circle(iconX, 0, iconR, item.done ? 0x2a2413 : 0x141c28);
    disc.setStrokeStyle(2, item.done ? 0xffd166 : 0x3a4450, item.done ? 0.9 : 0.6);

    const icon = this.add
      .image(iconX, 0, `icon-${item.icon}`)
      .setDisplaySize(iconR * 1.15, iconR * 1.15)
      .setTint(item.done ? 0xffd166 : 0x8fa3b0);

    const textX = -half + 30 * s + iconR + 14 * s;

    const name = this.add
      .text(textX, -rowH * 0.18, item.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);
    name.setResolution(TEXT_RESOLUTION);

    const desc = this.add
      .text(textX, rowH * 0.18, item.desc, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: Math.max(80, cardW - (textX + half) - 90 * s) }
      })
      .setOrigin(0, 0.5);
    desc.setResolution(TEXT_RESOLUTION);

    const parts = [card, disc, icon, name, desc];

    if (!item.done) {
      const progress = this.add
        .text(half - 20 * s, 0, `${item.value}/${item.goal}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(12 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(1, 0.5);
      progress.setResolution(TEXT_RESOLUTION);
      parts.push(progress);
    } else if (item.claimed) {
      const check = this.add
        .image(half - 30 * s, -8 * s, 'icon-check')
        .setDisplaySize(18 * s, 18 * s)
        .setTint(0xffd166);

      const claimed = this.add
        .text(half - 16 * s, 12 * s, '已领取', {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(1, 0.5);
      claimed.setResolution(TEXT_RESOLUTION);

      parts.push(check, claimed);
    } else {
      const coin = this.add
        .image(half - 74 * s, -8 * s, 'coin')
        .setDisplaySize(14 * s, 14 * s);
      const amount = this.add
        .text(half - 62 * s, -8 * s, `+${item.reward}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.goldHex,
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5);
      amount.setResolution(TEXT_RESOLUTION);

      const hint = this.add
        .text(half - 16 * s, 12 * s, '点击领取', {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(1, 0.5);
      hint.setResolution(TEXT_RESOLUTION);

      parts.push(coin, amount, hint);
    }

    const container = this.add.container(0, 0, parts);
    container.setDepth(2);
    return container;
  }

  /// Places every row at its scrolled position and hides the ones outside the
  /// visible strip, so the list never spills over the title or the button.
  applyScroll() {
    const W = this.scale.gameSize.width;
    const step = this.rowH + this.rowGap;
    const top = this.listTop;

    for (const row of this.rows) {
      const centre = top + row.index * step + this.rowH / 2 + this.scrollY;
      row.node.setPosition(W / 2, centre);
      row.zone.setPosition(W / 2, centre);

      const visible =
        centre + this.rowH / 2 > top - 2 && centre - this.rowH / 2 < this.listBottom + 2;
      row.node.setVisible(visible);
      if (row.zone.input) row.zone.input.enabled = visible && row.claimable;
    }
  }

  onDragStart(pointer) {
    this.dragging = true;
    this.dragDistance = 0;
    this.dragStartY = pointer.y;
  }

  onDragMove(pointer) {
    if (!this.dragging) return;

    const delta = pointer.y - this.dragStartY;
    this.dragDistance += Math.abs(delta);
    this.dragStartY = pointer.y;

    if (this.maxScroll <= 0) return;

    const next = Phaser.Math.Clamp(this.scrollY + delta, -this.maxScroll, 0);
    if (next === this.scrollY) return;

    this.scrollY = next;
    this.applyScroll();
  }

  onDragEnd() {
    this.dragging = false;
  }

  /// Pays out one earned achievement into the bank the next run starts with.
  claim(item) {
    const amount = claimReward(item.key);
    if (amount <= 0) return;

    haptic('impact');
    Sfx.coin();

    this.rebuild();
    this.showToast(amount);
  }

  showToast(amount) {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const s = Math.min(1.6, Math.max(0.9, W / 420));

    const label = this.add
      .text(W / 2, H * 0.16, `领取 ${amount} 金币`, {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    label.setResolution(TEXT_RESOLUTION);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: '-=20',
      duration: 220,
      ease: 'Cubic.out'
    });

    this.time.delayedCall(1400, () => {
      if (!label.active) return;
      this.tweens.add({
        targets: label,
        alpha: 0,
        duration: 300,
        onComplete: () => label.destroy()
      });
    });
  }

  goBack() {
    haptic('tick');
    this.scene.start('Title');
  }
}
