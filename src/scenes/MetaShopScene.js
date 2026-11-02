// The star dust shop: permanent perks, locked characters and player tints bought
// between runs. Star dust only lives here — in-run coins are never spent on it.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { TEXT_RESOLUTION, sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { DPR, applyCameraZoom, viewSize } from '../ui/view.js';
import { Sfx } from '../game/audio.js';
import {
  loadMeta,
  META_PERKS,
  META_SKINS,
  META_ACCESSORIES,
  META_CHARACTER_COSTS,
  perkLevel,
  buyPerk,
  buyCharacter,
  buySkin,
  equipSkin,
  buyAccessory,
  toggleAccessory
} from '../game/meta.js';
import { CHARACTERS } from '../game/characters.js';
import { loadProgress, isUnlocked } from '../game/progress.js';

export class MetaShopScene extends Phaser.Scene {
  constructor() {
    super('MetaShop');
  }

  create() {
    applyCameraZoom(this);
    this.scrollY = 0;
    this.maxScroll = 0;
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

  /// The shop's rows: section headers and the items inside them.
  entries() {
    const meta = loadMeta();
    const progress = loadProgress();
    const list = [];

    list.push({ type: 'header', text: '永久属性', sub: '每局开局自动生效' });
    for (const perk of META_PERKS) {
      const level = perkLevel(meta, perk.key);
      list.push({
        type: 'item',
        kind: 'perk',
        key: perk.key,
        name: perk.name,
        desc: perk.desc,
        icon: perk.icon,
        level,
        max: perk.max,
        cost: level < perk.max ? perk.cost(level) : 0,
        status: level >= perk.max ? '已满级' : `Lv ${level}/${perk.max}`
      });
    }

    list.push({ type: 'header', text: '解锁角色', sub: '花星尘提前解锁，不用等活动' });
    for (const character of CHARACTERS) {
      if (!character.unlock) continue;

      const unlocked =
        isUnlocked(progress, character) || meta.characters.indexOf(character.key) !== -1;

      list.push({
        type: 'item',
        kind: 'character',
        key: character.key,
        name: character.name,
        desc: character.desc,
        icon: 'users',
        cost: META_CHARACTER_COSTS[character.key] || 0,
        owned: unlocked,
        status: unlocked ? '已解锁' : character.unlock.text
      });
    }

    list.push({ type: 'header', text: '装扮', sub: '只换颜色，不影响任何属性' });
    for (const skin of META_SKINS) {
      const owned = meta.skins.indexOf(skin.key) !== -1;
      const equipped = meta.skin === skin.key;

      list.push({
        type: 'item',
        kind: 'skin',
        key: skin.key,
        name: skin.name,
        desc: skin.desc,
        icon: 'sparkles',
        cost: skin.cost,
        owned,
        equipped,
        status: equipped ? '使用中' : owned ? '已拥有' : ''
      });
    }

    list.push({ type: 'header', text: '配件', sub: '搞怪头脸与身体光效，点击穿戴 / 卸下' });
    for (const item of META_ACCESSORIES) {
      const owned = meta.accessories.indexOf(item.key) !== -1;
      const worn = meta.worn.indexOf(item.key) !== -1;

      list.push({
        type: 'item',
        kind: 'accessory',
        key: item.key,
        name: item.name,
        desc: item.desc,
        icon: item.icon,
        cost: item.cost,
        owned,
        equipped: worn,
        status: worn ? '穿戴中' : owned ? '已拥有' : ''
      });
    }

    return list;
  }

  build() {
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const L = computeLayout(W, H);
    const s = L.uiScale;
    const meta = loadMeta();

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 1).setDepth(0);

    const titleY = Math.max(44 * s, H * 0.07);

    this.add
      .text(W / 2, titleY, '星尘商店', {
        fontFamily: FONT,
        fontSize: `${Math.round(23 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .image(W / 2 - 44 * s, titleY + 27 * s, 'icon-sparkles')
      .setDisplaySize(15 * s, 15 * s)
      .setTint(0xffd166)
      .setDepth(2);

    this.add
      .text(W / 2 - 32 * s, titleY + 27 * s, `星尘 ${meta.shards}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(2);

    const listTop = titleY + 52 * s;
    const listBottom = H - 76 * s;
    const cardW = Math.min(W - 28, 430 * s);
    const gap = Math.max(6, Math.round(8 * s));

    this.listTop = listTop;
    this.listBottom = listBottom;
    this.cardW = cardW;
    this.gap = gap;
    this.rows = [];

    const rows = this.entries();
    let cursor = 0;

    for (const entry of rows) {
      const height =
        entry.type === 'header'
          ? Math.round(34 * s)
          : Math.max(56, Math.round(66 * s));
      const centre = listTop + cursor + height / 2;

      const node =
        entry.type === 'header'
          ? this.buildHeader(entry, cardW, s)
          : this.buildItem(entry, cardW, height, s);

      node.setPosition(W / 2, centre);
      node.setDepth(2);

      let zone = null;
      const actionable =
        entry.type === 'item' &&
        ((entry.kind === 'perk' && entry.level < entry.max) ||
          (entry.kind === 'character' && !entry.owned) ||
          (entry.kind === 'skin' && (!entry.owned || !entry.equipped)));

      if (actionable) {
        zone = this.add
          .zone(W / 2, centre, cardW, height)
          .setDepth(3)
          .setOrigin(0.5);
        zone.setInteractive();
        zone.on('pointerup', () => {
          if (this.dragDistance > 14) return;
          this.buy(entry);
        });
      }

      this.rows.push({ node, zone, centre, height, actionable });
      cursor += height + gap;
    }

    const contentH = Math.max(0, cursor - gap);
    this.maxScroll = Math.max(0, contentH - (listBottom - listTop));
    this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScroll, 0);
    this.applyScroll();

    if (this.maxScroll > 0) {
      this.add
        .text(W / 2, H - 34 * s, '上下拖动查看全部 · 点卡片购买', {
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
      depth: 4,
      onPress: () => this.goBack()
    });

    sharpenText(this);
  }

  buildHeader(entry, cardW, s) {
    const half = cardW / 2;

    const title = this.add
      .text(-half + 8 * s, 0, entry.text, {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);
    title.setResolution(TEXT_RESOLUTION);

    const sub = this.add
      .text(-half + 8 * s + title.width + 10 * s, 0, entry.sub, {
        fontFamily: FONT,
        fontSize: `${Math.round(10 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0, 0.5);
    sub.setResolution(TEXT_RESOLUTION);

    return this.add.container(0, 0, [title, sub]);
  }

  buildItem(entry, cardW, height, s) {
    const half = cardW / 2;
    const halfH = height / 2;

    const card = this.add.graphics();
    card.fillStyle(0x0f1521, 0.97);
    card.fillRoundedRect(-half, -halfH, cardW, height, 14);
    card.lineStyle(2, 0x2bd3c4, 0.28);
    card.strokeRoundedRect(-half, -halfH, cardW, height, 14);

    const iconX = -half + 30 * s;
    const iconR = Math.min(halfH - 6 * s, 16 * s);

    const disc = this.add.circle(iconX, 0, iconR, 0x141c28);
    disc.setStrokeStyle(2, 0x3a4450, 0.6);

    const icon = this.add
      .image(iconX, 0, `icon-${entry.icon}`)
      .setDisplaySize(iconR * 1.15, iconR * 1.15)
      .setTint(0x8fa3b0);

    const textX = iconX + iconR + 14 * s;
    const wrapWidth = Math.max(80, cardW - (textX + half) - 96 * s);

    const name = this.add
      .text(textX, -height * 0.18, entry.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);
    name.setResolution(TEXT_RESOLUTION);

    const desc = this.add
      .text(textX, height * 0.2, entry.desc, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: wrapWidth }
      })
      .setOrigin(0, 0.5);
    desc.setResolution(TEXT_RESOLUTION);

    const parts = [card, disc, icon, name, desc];

    if (entry.status) {
      const status = this.add
        .text(half - 16 * s, -height * 0.18, entry.status, {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: entry.equipped ? COLORS.accentHex : COLORS.dim
        })
        .setOrigin(1, 0.5);
      status.setResolution(TEXT_RESOLUTION);
      parts.push(status);
    }

    const price = entry.cost || 0;
    const showPrice =
      price > 0 &&
      !((entry.kind === 'skin' || entry.kind === 'accessory') && entry.owned);

    if (showPrice) {
      const coin = this.add
        .image(half - 64 * s, height * 0.2, 'icon-sparkles')
        .setDisplaySize(12 * s, 12 * s)
        .setTint(0xffd166);
      const amount = this.add
        .text(half - 52 * s, height * 0.2, String(price), {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.goldHex,
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5);
      amount.setResolution(TEXT_RESOLUTION);
      parts.push(coin, amount);
    } else if (
      (entry.kind === 'skin' || entry.kind === 'accessory') &&
      entry.owned &&
      !entry.equipped
    ) {
      const hint = this.add
        .text(half - 16 * s, height * 0.2, '点击使用', {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(1, 0.5);
      hint.setResolution(TEXT_RESOLUTION);
      parts.push(hint);
    }

    return this.add.container(0, 0, parts);
  }

  applyScroll() {
    const W = viewSize(this).width;

    for (const row of this.rows) {
      const y = row.centre + this.scrollY;
      row.node.setPosition(W / 2, y);
      if (row.zone) row.zone.setPosition(W / 2, y);

      const visible =
        y + row.height / 2 > this.listTop - 2 &&
        y - row.height / 2 < this.listBottom + 2;

      row.node.setVisible(visible);
      if (row.zone && row.zone.input) {
        row.zone.input.enabled = visible && row.actionable;
      }
    }
  }

  buy(entry) {
    let paid = 0;
    let message = '';

    if (entry.kind === 'perk') {
      paid = buyPerk(entry.key);
      if (paid > 0) message = `${entry.name} 提升`;
    } else if (entry.kind === 'character') {
      paid = buyCharacter(entry.key);
      if (paid > 0) message = `解锁角色 ${entry.name}`;
    } else if (entry.kind === 'skin') {
      if (entry.owned) {
        if (equipSkin(entry.key)) {
          message = `已换上 ${entry.name}`;
          paid = -1;
        }
      } else {
        paid = buySkin(entry.key);
        if (paid > 0) message = `已换上 ${entry.name}`;
      }
    } else if (entry.kind === 'accessory') {
      if (entry.owned) {
        const worn = toggleAccessory(entry.key);
        message = worn ? `穿上 ${entry.name}` : `脱下 ${entry.name}`;
        paid = -1;
      } else {
        paid = buyAccessory(entry.key);
        if (paid > 0) message = `买下并穿上 ${entry.name}`;
      }
    }

    if (paid === 0) {
      haptic('tick');
      return;
    }

    haptic('impact');
    Sfx.buy();
    this.rebuild();
    if (message) this.showToast(message);
  }

  showToast(text) {
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const s = Math.min(1.6, Math.max(0.9, W / 420));

    const label = this.add
      .text(W / 2, H * 0.16, text, {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    label.setResolution(TEXT_RESOLUTION);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: '-=18',
      duration: 200,
      ease: 'Cubic.out'
    });

    this.time.delayedCall(1200, () => {
      if (!label.active) return;
      this.tweens.add({
        targets: label,
        alpha: 0,
        duration: 300,
        onComplete: () => label.destroy()
      });
    });
  }

  onDragStart(pointer) {
    this.dragging = true;
    this.dragDistance = 0;
    this.dragStartY = pointer.y / DPR;
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
