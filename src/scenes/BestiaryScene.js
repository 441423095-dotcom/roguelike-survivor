// The monster archive: one card per creature, with its portrait, when it shows
// up and a line of advice. Tapping a known entry expands its raw numbers; the
// ones not met yet stay a black silhouette. The list scrolls by dragging.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { TEXT_RESOLUTION, sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { DPR, applyCameraZoom, viewSize } from '../ui/view.js';
import { bestiaryState } from '../game/bestiary.js';
import { startMusic } from '../game/audio.js';

export class BestiaryScene extends Phaser.Scene {
  constructor() {
    super('Bestiary');
  }

  create() {
    applyCameraZoom(this);
    startMusic(this, 'menu');
    this.scrollY = 0;
    this.maxScroll = 0;
    this.expanded = null;
    this.dragging = false;
    this.dragDistance = 0;

    this.onDragStart = this.onDragStart.bind(this);
    this.onDragMove = this.onDragMove.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);

    this.build();

    this.input.on('pointerdown', this.onDragStart);
    this.input.on('pointermove', this.onDragMove);
    this.input.on('pointerup', this.onDragEnd);
    this.input.on('pointerupoutside', this.onDragEnd);

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.input.off('pointerdown', this.onDragStart);
      this.input.off('pointermove', this.onDragMove);
      this.input.off('pointerup', this.onDragEnd);
      this.input.off('pointerupoutside', this.onDragEnd);
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
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    const state = bestiaryState();

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 1).setDepth(0);

    const titleY = Math.max(44 * s, H * 0.07);

    this.add
      .text(W / 2, titleY, '怪物图鉴', {
        fontFamily: FONT,
        fontSize: `${Math.round(23 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(W / 2, titleY + 25 * s, `已发现 ${state.found}/${state.total}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    const listTop = titleY + 56 * s;
    const listBottom = H - 78 * s;
    const cardW = Math.min(W - 28, 430 * s);
    const gap = Math.max(6, Math.round(8 * s));

    this.listTop = listTop;
    this.listBottom = listBottom;
    this.cardW = cardW;
    this.gap = gap;
    this.rows = [];
    this.zones = [];

    let cursor = 0;
    for (const item of state.items) {
      const height = this.rowHeight(item, s);
      const centre = listTop + cursor + height / 2;

      const node = this.buildRow(item, cardW, height, s);
      node.setPosition(W / 2, centre);
      node.setDepth(2);

      const zone = this.add
        .zone(W / 2, centre, cardW, height)
        .setDepth(3)
        .setOrigin(0.5);
      zone.setInteractive();

      if (item.done) {
        zone.on('pointerup', () => {
          if (this.dragDistance > 14) return;
          this.toggle(item.key);
        });
      }

      this.rows.push({ node, zone, centre, height, offset: cursor });
      cursor += height + gap;
    }

    const contentH = Math.max(0, cursor - gap);
    this.maxScroll = Math.max(0, contentH - (listBottom - listTop));
    this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScroll, 0);
    this.applyScroll();

    if (this.maxScroll > 0) {
      this.add
        .text(W / 2, H - 34 * s, '上下拖动查看全部 · 点卡片展开数值', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0.5)
        .setDepth(2);
    } else {
      this.add
        .text(W / 2, H - 34 * s, '点卡片展开数值', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0.5)
        .setDepth(2);
    }

    makeButton(this, {
      x: W / 2,
      y: H - 58 * s,
      width: Math.min(W - 60, 210 * s),
      height: Math.round(40 * s),
      icon: 'chevron-left',
      label: '返回标题',
      fontSize: Math.round(14 * s),
      accent: 0x2bd3c4,
      depth: 4,
      onPress: () => this.goBack()
    });

    sharpenText(this);
  }

  rowHeight(item, s) {
    const base = Math.max(62, Math.round(74 * s));
    return this.expanded === item.key && item.done ? base + 28 * s : base;
  }

  buildRow(item, cardW, height, s) {
    const half = cardW / 2;
    const halfH = height / 2;

    const card = this.add.graphics();
    card.fillStyle(item.done ? 0x0f1521 : 0x0b0f16, 0.97);
    card.fillRoundedRect(-half, -halfH, cardW, height, 14);
    card.lineStyle(
      2,
      item.done ? 0x2bd3c4 : 0x2a3644,
      item.done ? this.expanded === item.key ? 0.75 : 0.32 : 0.18
    );
    card.strokeRoundedRect(-half, -halfH, cardW, height, 14);

    const spriteX = -half + 36 * s;
    const spriteSize = Math.min(44 * s, height - 18 * s);

    const portrait = this.add
      .image(spriteX, 0, item.texture)
      .setDisplaySize(spriteSize, spriteSize);

    if (!item.done) portrait.setTint(0x0a0d12);

    const textX = -half + 66 * s;
    const wrapWidth = Math.max(90, cardW - 66 * s - 26 * s);

    const name = this.add
      .text(textX, -height * 0.26, item.done ? item.name : '？？？', {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * s)}px`,
        color: item.done ? COLORS.ink : COLORS.dim,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);
    name.setResolution(TEXT_RESOLUTION);

    const waveLabel = !item.done
      ? '出现于：——'
      : item.wave > 0
        ? `出现于：第 ${item.wave} 波起`
        : '出现于：道具召唤';

    const wave = this.add
      .text(textX, -height * 0.02, waveLabel, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.accentHex
      })
      .setOrigin(0, 0.5);
    wave.setResolution(TEXT_RESOLUTION);

    const desc = this.add
      .text(textX, height * 0.2, item.done ? item.desc : '未发现', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: wrapWidth }
      })
      .setOrigin(0, 0.5);
    desc.setResolution(TEXT_RESOLUTION);

    const parts = [card, portrait, name, wave, desc];

    if (item.done) {
      const hint = this.add
        .text(
          half - 16 * s,
          -height * 0.26,
          this.expanded === item.key ? '收起' : '展开',
          {
            fontFamily: FONT,
            fontSize: `${Math.round(11 * s)}px`,
            color: COLORS.dim
          }
        )
        .setOrigin(1, 0.5);
      hint.setResolution(TEXT_RESOLUTION);
      parts.push(hint);
    }

    if (item.done && this.expanded === item.key) {
      const stats = this.add
        .text(
          textX,
          halfH - 16 * s,
          `生命 ${item.stats.hp}    移动速度 ${item.stats.speed}    伤害 ${item.stats.damage}`,
          {
            fontFamily: FONT,
            fontSize: `${Math.round(11 * s)}px`,
            color: COLORS.goldHex,
            fontStyle: 'bold'
          }
        )
        .setOrigin(0, 0.5);
      stats.setResolution(TEXT_RESOLUTION);
      parts.push(stats);
    }

    return this.add.container(0, 0, parts);
  }

  /// Places every card at its scrolled position and hides the ones outside the
  /// visible strip so nothing spills over the title or the buttons.
  applyScroll() {
    const W = viewSize(this).width;

    for (const row of this.rows) {
      const y = row.centre + this.scrollY;
      row.node.setPosition(W / 2, y);
      row.zone.setPosition(W / 2, y);

      const visible =
        y + row.height / 2 > this.listTop - 2 &&
        y - row.height / 2 < this.listBottom + 2;

      row.node.setVisible(visible);
      if (row.zone.input) row.zone.input.enabled = visible;
    }
  }

  toggle(key) {
    haptic('tick');
    this.expanded = this.expanded === key ? null : key;
    this.rebuild();
  }

  onDragStart(pointer) {
    this.dragging = true;
    this.dragDistance = 0;
    this.dragStartY = pointer.y / DPR;
    this.dragStartScroll = this.scrollY;
  }

  onDragMove(pointer) {
    if (!this.dragging) return;

    const delta = pointer.y / DPR - this.dragStartY;
    this.dragDistance += Math.abs(delta);
    this.dragStartY = pointer.y / DPR;

    if (this.maxScroll <= 0) return;

    const next = Phaser.Math.Clamp(this.scrollY + delta, -this.maxScroll, 0);
    if (next === this.scrollY) return;

    this.scrollY = next;
    this.applyScroll();
  }

  onDragEnd() {
    this.dragging = false;
  }

  goBack() {
    haptic('tick');
    this.scene.start('Title');
  }
}
