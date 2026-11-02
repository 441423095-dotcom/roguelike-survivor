// Shown when a weapon crate is picked up with all three slots full: swap one of
// the carried guns for the new one, or weld two level-3 guns into one evolved
// weapon and keep the newcomer as well.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { Sfx } from '../game/audio.js';

export class WeaponScene extends Phaser.Scene {
  constructor() {
    super('Weapon');
  }

  init(data) {
    this.newWeapon =
      (data && data.weapon) || { name: '武器', emoji: '🔫', color: 0x39e6cd };
    this.carried = (data && data.carried) || [];
    this.settled = false;
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

  run() {
    return this.scene.get('Game');
  }

  /// Two carried guns can be welded together once both are level 3. The highest
  /// level pair is offered first.
  mergePair() {
    let best = null;

    for (let i = 0; i < this.carried.length; i++) {
      for (let j = i + 1; j < this.carried.length; j++) {
        const a = this.carried[i];
        const b = this.carried[j];
        if ((a.level || 1) < 3 || (b.level || 1) < 3) continue;

        const total = (a.level || 1) + (b.level || 1);
        if (!best || total > best.total) best = { a: i, b: j, total };
      }
    }

    return best;
  }

  build() {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    const merge = this.mergePair();
    const rows = Math.max(1, this.carried.length + (merge ? 1 : 0));

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 0.86).setDepth(1);

    const titleY = Math.max(44 * s, H * 0.075);

    this.add
      .text(W / 2, titleY, '武器已满', {
        fontFamily: FONT,
        fontSize: `${Math.round(22 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(
        W / 2,
        titleY + 26 * s,
        `新武器：${this.newWeapon.emoji} ${this.newWeapon.name}`,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(14 * s)}px`,
          color: COLORS.accentHex
        }
      )
      .setOrigin(0.5)
      .setDepth(2);

    const areaTop = titleY + 52 * s;
    const areaBottom = H - 96 * s;
    const gap = Math.round(8 * s);
    const cardW = Math.min(W - 32, 430 * s);
    const avail = Math.max(120, areaBottom - areaTop);
    const cardH = Math.max(
      52,
      Math.min(86 * s, (avail - gap * (rows - 1)) / rows)
    );

    this.carried.forEach((slot, index) => {
      const cy = areaTop + index * (cardH + gap) + cardH / 2;
      this.buildCard({
        cx: W / 2,
        cy,
        w: cardW,
        h: cardH,
        s,
        title: `${slot.emoji} ${slot.name}`,
        sub: `Lv ${slot.level} · 点这里用它换下新武器`,
        emoji: slot.emoji,
        color: slot.color,
        action: () => this.replace(index)
      });
    });

    if (merge) {
      const index = this.carried.length;
      const cy = areaTop + index * (cardH + gap) + cardH / 2;
      const a = this.carried[merge.a];
      const b = this.carried[merge.b];

      this.buildCard({
        cx: W / 2,
        cy,
        w: cardW,
        h: cardH,
        s,
        title: `合成进化：${a.name} + ${b.name}`,
        sub: '两把 3 级武器合为一把进化武器，并额外保留新武器',
        emoji: '🌟',
        color: 0xffd166,
        action: () => this.merge(merge.a, merge.b)
      });
    }

    makeButton(this, {
      x: W / 2,
      y: H - 56 * s,
      width: Math.min(W - 60, 250 * s),
      height: Math.round(44 * s),
      icon: 'chevron-left',
      label: '放弃这把武器',
      accent: 0x8fa3b0,
      depth: 4,
      onPress: () => this.skip()
    });

    this.add
      .text(W / 2, H - 24 * s, '换下来的武器会直接消失', {
        fontFamily: FONT,
        fontSize: `${Math.round(12 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(2);

    sharpenText(this);
  }

  buildCard(opts) {
    const { cx, cy, w, h, s, title, sub, emoji, color, action } = opts;
    const stroke = color || 0x2bd3c4;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0f1521, 0.97);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    g.lineStyle(2, stroke, 0.75);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);

    const iconSize = Math.min(h * 0.46, 36 * s);
    const iconX = cx - w / 2 + 20 * s + iconSize / 2;

    this.add
      .text(iconX, cy, emoji || '🔫', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(iconSize * 0.95)}px`
      })
      .setOrigin(0.5)
      .setDepth(3);

    const textX = iconX + iconSize / 2 + 14 * s;
    const textW = Math.max(70, cx + w / 2 - 16 * s - textX);

    this.add
      .text(textX, cy - h * 0.18, title, {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold',
        wordWrap: { width: textW }
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    this.add
      .text(textX, cy + h * 0.18, sub, {
        fontFamily: FONT,
        fontSize: `${Math.round(12 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: textW }
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    const zone = this.add.zone(cx, cy, w, h).setInteractive();
    zone.on('pointerdown', action);
  }

  replace(index) {
    if (this.settled) return;
    const run = this.run();
    if (!run || !run.applyWeaponPick) {
      this.skip();
      return;
    }

    this.settled = true;
    haptic('tick');
    run.applyWeaponPick(index);
    this.close();
  }

  merge(a, b) {
    if (this.settled) return;
    const run = this.run();
    if (!run || !run.mergeWeapons) {
      this.skip();
      return;
    }

    this.settled = true;
    haptic('tick');
    run.mergeWeapons(a, b);
    this.close();
  }

  skip() {
    if (this.settled) return;
    this.settled = true;

    haptic('tick');
    Sfx.click();

    const run = this.run();
    if (run && run.skipWeaponPick) run.skipWeaponPick();
    this.close();
  }

  close() {
    const run = this.run();
    this.scene.stop();
    if (run && run.finishWeaponChoice) run.finishWeaponChoice();
  }
}
