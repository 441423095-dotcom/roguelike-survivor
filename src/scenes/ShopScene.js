// The between-wave shop: a shelf of odd passive trinkets, plus a paid refresh.
// It sits over the frozen run and lets the player buy as much as their purse
// allows — or walk away with the coins. Plain stat cards live in the level-up
// picks, never here.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { Sfx } from '../game/audio.js';
import { SHOP_REFRESH_COST } from '../game/shop.js';
import { WEAPONS, weaponDef } from '../game/weapons.js';
import { mergeCost, nextRarity, rarityFor, weaponName } from '../game/rarities.js';
import { ITEM_BY_KEY } from '../game/passives.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.wave = (data && data.wave) || 1;
    this.items = (data && data.items) || [];
    this.refs = [];
    this.replaceItem = null;
    this.sellTarget = null;
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
    this.refs = [];
    this.build();
  }

  rebuild() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.refs = [];
    this.build();
  }

  run() {
    return this.scene.get('Game');
  }

  coins() {
    const run = this.run();
    return run && run.state ? Math.floor(run.state.coins) : 0;
  }

  /// The purse reads "34/50" once 生锈的硬币 has locked it, so the cap is never a
  /// surprise.
  purse() {
    const run = this.run();
    const cap = run && run.state ? run.state.coinCap : Infinity;
    const coins = this.coins();
    return Number.isFinite(cap) ? `${coins}/${cap}` : String(coins);
  }

  /// How many of this item the run already owns, read live so the card's tag
  /// updates the moment a copy is bought.
  owned(key) {
    const run = this.run();
    return run && run.items ? run.items[key] || 0 : 0;
  }

  /// The run owns the stock, so a refresh shows up here as soon as it is made.
  stock() {
    const run = this.run();
    if (run && Array.isArray(run.shopItems) && run.shopItems.length > 0) {
      return run.shopItems;
    }
    return this.items;
  }

  build() {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const L = computeLayout(W, H);
    const s = L.uiScale;
    const items = this.stock();

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 0.86).setDepth(1);

    const titleY = Math.max(48 * s, H * 0.085);

    this.add
      .text(W / 2, titleY, '补给站', {
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
        titleY + 24 * s,
        `第 ${this.wave} 波结束 · 只卖奇怪道具，不买也能直接跳过`,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.dim
        }
      )
      .setOrigin(0.5)
      .setDepth(2);

    // Refresh, tucked into the top-right corner.
    makeButton(this, {
      x: W - 12 * s - 62 * s,
      y: titleY,
      width: 124 * s,
      height: 34 * s,
      icon: 'rotate-ccw',
      label: `刷新 ${SHOP_REFRESH_COST}`,
      fontSize: Math.round(13 * s),
      accent: 0xb07bff,
      depth: 3,
      onPress: () => this.refreshItems()
    });

    // Purse: what the player has to spend right now.
    const purseY = titleY + 54 * s;
    this.add
      .image(W / 2 - 26 * s, purseY, 'coin')
      .setDisplaySize(17 * s, 17 * s)
      .setDepth(3);
    this.coinText = this.add
      .text(W / 2 - 12 * s, purseY, this.purse(), {
        fontFamily: FONT,
        fontSize: `${Math.round(17 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    // Cards, vertically centred between the header and the continue button.
    const cardW = Math.min(W - 32, 430 * s);
    const gap = Math.round(8 * s);

    // A mergeable pair gets its own strip above the cards.
    const pairs = this.mergePairs();
    const bannerH = pairs.length > 0 ? Math.round(42 * s) : 0;

    if (pairs.length > 0) {
      this.buildMergeBanner(
        pairs[0],
        W / 2,
        purseY + 22 * s + bannerH / 2,
        cardW,
        bannerH,
        s
      );
    }

    const areaTop = purseY + 22 * s + (bannerH > 0 ? bannerH + 8 * s : 0);
    const areaBottom = H - 156 * s;
    const count = Math.max(1, items.length);
    const avail = Math.max(120, areaBottom - areaTop);
    const cardH = Math.max(
      58,
      Math.min(100 * s, (avail - gap * (count - 1)) / count)
    );
    const groupH = cardH * count + gap * (count - 1);
    const startY = areaTop + Math.max(0, (avail - groupH) / 2);

    items.forEach((item, index) => {
      const cy = startY + index * (cardH + gap) + cardH / 2;
      this.buildCard(item, index, W / 2, cy, cardW, cardH, s);
    });

    // What the run already carries, right where the thumb already is.
    this.buildOwnedBar(W, H, s);

    makeButton(this, {
      x: W / 2,
      y: H - 58 * s,
      width: Math.min(W - 60, 250 * s),
      height: Math.round(44 * s),
      icon: 'play',
      label: '继续战斗',
      fontSize: Math.round(16 * s),
      depth: 3,
      onPress: () => this.leave()
    });

    this.add
      .text(W / 2, H - 24 * s, '不买也可以继续，金币会留到下次', {
        fontFamily: FONT,
        fontSize: `${Math.round(12 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(3);

    sharpenText(this);
  }

  /// The owned-gear strip: weapons on the left, items on the right. Tapping a
  /// chip sells it, or picks it as the slot to replace while that mode is on.
  buildOwnedBar(W, H, s) {
    const run = this.run();
    if (!run || !run.state) return;

    const barW = Math.min(W - 24, 430 * s);
    const barH = Math.round(66 * s);
    const x = (W - barW) / 2;
    const y = H - 118 * s;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0b1018, 0.92);
    g.fillRoundedRect(x, y - barH / 2, barW, barH, 12);
    g.lineStyle(2, this.replaceItem ? 0xffd166 : 0x2bd3c4, this.replaceItem ? 0.8 : 0.3);
    g.strokeRoundedRect(x, y - barH / 2, barW, barH, 12);

    // Split the strip in half with a hairline.
    g.lineStyle(1, 0x2bd3c4, 0.18);
    g.lineBetween(x + barW / 2, y - barH / 2 + 8 * s, x + barW / 2, y + barH / 2 - 8 * s);

    const labelY = y - barH / 2 + 10 * s;

    if (this.replaceItem) {
      const pending = this.stock()[this.replaceItem.index];
      const pendingName = pending ? pending.name : '新武器';

      const hint = this.add
        .text(x + 10 * s, labelY, `点武器替换：${pendingName}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.goldHex,
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
        .setDepth(3);
      hint.setResolution(2);

      const cancel = this.add
        .text(x + barW - 10 * s, labelY, '取消', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(1, 0.5)
        .setDepth(3)
        .setInteractive();
      cancel.on('pointerdown', () => {
        this.replaceItem = null;
        haptic('tick');
        this.rebuild();
      });
    } else {
      this.add
        .text(x + 10 * s, labelY, '武器', {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0, 0.5)
        .setDepth(3);

      this.add
        .text(x + barW / 2 + 10 * s, labelY, '道具', {
          fontFamily: FONT,
          fontSize: `${Math.round(10 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0, 0.5)
        .setDepth(3);
    }

    const r = Math.max(11, Math.round(15 * s));
    const step = r * 2 + 6 * s;
    const chipY = y + 10 * s;

    // Weapons, left half.
    run.state.weapons.forEach((slot, index) => {
      if (index >= 3) return;

      const cx = x + 26 * s + index * step;
      const def = weaponDef(slot);
      const ring = rarityFor(slot.rarity).color;

      g.fillStyle(0x0d1522, 0.9);
      g.fillCircle(cx, chipY, r);
      g.lineStyle(2, ring, 0.9);
      g.strokeCircle(cx, chipY, r);

      this.add
        .text(cx, chipY, def ? def.emoji : '🔫', {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: `${Math.round(r * 1.15)}px`
        })
        .setOrigin(0.5)
        .setDepth(3);

      const zone = this.add.zone(cx, chipY, r * 2 + 4, r * 2 + 4).setInteractive();
      zone.on('pointerdown', () => this.tapWeapon(index));
    });

    // Items, right half.
    const keys = Object.keys(run.items).filter((key) => run.items[key] > 0);
    const shown = keys.slice(0, 5);

    shown.forEach((key, index) => {
      const def = ITEM_BY_KEY[key];
      if (!def) return;

      const cx = x + barW / 2 + 26 * s + index * (r * 2 + 5 * s);

      g.fillStyle(0x0d1522, 0.9);
      g.fillCircle(cx, chipY, r);
      g.lineStyle(2, def.color, 0.75);
      g.strokeCircle(cx, chipY, r);

      this.add
        .text(cx, chipY, def.emoji, {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: `${Math.round(r * 1.1)}px`
        })
        .setOrigin(0.5)
        .setDepth(3);

      const zone = this.add.zone(cx, chipY, r * 2 + 4, r * 2 + 4).setInteractive();
      zone.on('pointerdown', () => this.tapItem(key));
    });

    if (keys.length > shown.length) {
      this.add
        .text(
          x + barW - 8 * s,
          chipY,
          `+${keys.length - shown.length}`,
          {
            fontFamily: FONT,
            fontSize: `${Math.round(10 * s)}px`,
            color: COLORS.dim
          }
        )
        .setOrigin(1, 0.5)
        .setDepth(3);
    }
  }

  tapWeapon(index) {
    const run = this.run();
    if (!run || !run.state) return;

    if (this.replaceItem) {
      this.pickReplace(index);
      return;
    }

    const slot = run.state.weapons[index];
    if (!slot) return;

    this.openSell({
      kind: 'weapon',
      index,
      name: weaponName(weaponDef(slot), slot.rarity),
      price: run.weaponSellPrice(slot)
    });
  }

  tapItem(key) {
    const run = this.run();
    if (!run) return;

    const def = ITEM_BY_KEY[key];
    if (!def) return;

    this.openSell({
      kind: 'item',
      key,
      name: def.name,
      price: run.itemSellPrice(key)
    });
  }

  /// Swaps the pending weapon into the slot just tapped.
  pickReplace(index) {
    const pending = this.replaceItem;
    const run = this.run();
    if (!pending || !run || !run.replaceWeaponSlot) return;

    if (!run.replaceWeaponSlot(index, pending.index)) {
      haptic('tick');
      return;
    }

    this.replaceItem = null;
    haptic('impact');
    Sfx.buy();
    this.rebuild();
  }

  /// The small sell dialog for one owned weapon or item.
  openSell(target) {
    this.sellTarget = target;

    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const s = computeLayout(W, H).uiScale;

    const panelW = Math.min(W - 60, 300 * s);
    const panelH = Math.round(160 * s);
    const cx = W / 2;
    const cy = H / 2;

    const dim = this.add
      .rectangle(cx, cy, W, H, 0x05080d, 0.7)
      .setDepth(20)
      .setInteractive();
    dim.on('pointerdown', () => this.closeSell());

    const panel = this.add.graphics().setDepth(21);
    panel.fillStyle(0x0d1522, 0.99);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 16);
    panel.lineStyle(2, 0x2bd3c4, 0.4);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 16);

    this.add
      .text(cx, cy - panelH / 2 + 26 * s, `出售 ${target.name}？`, {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.add
      .text(cx, cy - panelH / 2 + 50 * s, `返还 ${target.price} 金币`, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.goldHex
      })
      .setOrigin(0.5)
      .setDepth(22);

    makeButton(this, {
      x: cx - panelW / 4,
      y: cy + panelH / 2 - 34 * s,
      width: panelW / 2 - 16 * s,
      height: Math.round(36 * s),
      label: '出售',
      fontSize: Math.round(14 * s),
      accent: COLORS.gold,
      depth: 22,
      onPress: () => this.confirmSell()
    });

    makeButton(this, {
      x: cx + panelW / 4,
      y: cy + panelH / 2 - 34 * s,
      width: panelW / 2 - 16 * s,
      height: Math.round(36 * s),
      label: '取消',
      fontSize: Math.round(14 * s),
      accent: 0x2bd3c4,
      depth: 22,
      onPress: () => this.closeSell()
    });

    sharpenText(this);
  }

  closeSell() {
    this.sellTarget = null;
    this.rebuild();
  }

  confirmSell() {
    const target = this.sellTarget;
    const run = this.run();
    if (!target || !run) {
      this.closeSell();
      return;
    }

    const refund =
      target.kind === 'weapon'
        ? run.sellWeapon(target.index)
        : run.sellItem(target.key);

    if (!refund) {
      haptic('tick');
      this.closeSell();
      return;
    }

    haptic('impact');
    Sfx.buy();
    this.sellTarget = null;
    this.rebuild();
  }

  /// Identical guns at the same rarity, straight from the run's weapon slots.
  mergePairs() {
    const run = this.run();
    if (!run || !run.mergeablePairs) return [];
    return run.mergeablePairs();
  }

  /// The strip that offers the pair merge, with its price and a tap target.
  buildMergeBanner(pair, cx, cy, w, h, s) {
    const run = this.run();
    if (!run || !run.state) return;

    const slotA = run.state.weapons[pair.a];
    if (!slotA) return;

    const def = WEAPONS[slotA.key];
    const next = nextRarity(pair.rarity);
    if (!def || !next) return;

    const cost = mergeCost(pair.rarity);

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x2a2413, 0.92);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    g.lineStyle(2, next.color, 0.6);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);

    this.add
      .text(
        cx - w / 2 + 12 * s,
        cy,
        `可合成：${weaponName(def, pair.rarity)} ×2 → ${weaponName(def, next.key)}`,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.ink,
          fontStyle: 'bold'
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(3);

    makeButton(this, {
      x: cx + w / 2 - 46 * s,
      y: cy,
      width: Math.round(84 * s),
      height: Math.round(30 * s),
      label: `合成 ${cost}`,
      fontSize: Math.round(12 * s),
      accent: next.color,
      depth: 4,
      onPress: () => this.merge(pair)
    });
  }

  merge(pair) {
    const run = this.run();
    if (!run || !run.mergeWeaponPair) return;

    if (!run.mergeWeaponPair(pair.a, pair.b)) {
      haptic('tick');
      return;
    }

    haptic('impact');
    this.rebuild();
  }

  buildCard(item, index, cx, cy, w, h, s) {
    const color = Number.isFinite(item.color) ? item.color : COLORS.accent;
    const hex = item.hex || COLORS.accentHex;

    const g = this.add.graphics().setDepth(2);

    // Rarer weapon cards glow behind the border, so a gold pull reads as one.
    if (item.kind === 'weapon' && item.rank >= 2) {
      const spread = 3 + item.rank * 2;
      const glow = this.add.graphics().setDepth(1);
      glow.fillStyle(color, 0.08 + item.rank * 0.04);
      glow.fillRoundedRect(
        cx - w / 2 - spread,
        cy - h / 2 - spread,
        w + spread * 2,
        h + spread * 2,
        16
      );
      glow.lineStyle(3, color, 0.2 + item.rank * 0.07);
      glow.strokeRoundedRect(
        cx - w / 2 - spread,
        cy - h / 2 - spread,
        w + spread * 2,
        h + spread * 2,
        16
      );
    }

    const priceX = cx + w / 2 - 16 * s;
    const priceY = cy + h * 0.22;
    const lockX = cx + w / 2 - 27 * s;
    const lockY = cy - h * 0.18;
    const lockW = 44 * s;
    const lockH = 34 * s;

    const coinIcon = this.add
      .image(priceX - 30 * s, priceY, 'coin')
      .setDisplaySize(13 * s, 13 * s)
      .setDepth(3);
    const priceText = this.add
      .text(priceX, priceY, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * s)}px`,
        color: hex,
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(3);
    const soldText = this.add
      .text(priceX, priceY, '已购买', {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(3)
      .setVisible(false);

    // A proper tap target for pinning an item: big enough to hit with a thumb.
    const lockG = this.add.graphics().setDepth(4);
    const lockIcon = this.add
      .image(lockX, lockY, 'icon-lock')
      .setDisplaySize(16 * s, 16 * s)
      .setDepth(5);

    const iconSize = Math.min(h * 0.42, 36 * s);
    const iconX = cx - w / 2 + 20 * s + iconSize / 2;
    // Trinkets are pictured by their own emoji rather than a symbol texture.
    this.add
      .text(iconX, cy, item.emoji || '❓', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(iconSize * 0.95)}px`
      })
      .setOrigin(0.5)
      .setDepth(3);

    const textX = iconX + iconSize / 2 + 14 * s;
    const textW = Math.max(60, priceX - 52 * s - textX);

    const nameText = this.add
      .text(textX, cy - h * 0.18, item.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    const tagText = this.add
      .text(textX + nameText.width + 8 * s, cy - h * 0.18, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: hex
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    const paintTag = () => {
      if (item.kind === 'weapon') {
        tagText.setText(`${item.rarityName} · Lv${item.level}`);
        return;
      }

      const have = this.owned(item.key);
      const kind = item.active ? '主动' : '被动';
      tagText.setText(have > 0 ? `${kind} ×${have}` : `${kind}道具`);
    };

    paintTag();

    this.add
      .text(textX, cy + h * 0.16, item.desc, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: textW }
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    let lockZone = null;

    const paintLock = () => {
      const saved = !!item.saved;
      const usable = !item.sold;

      lockG.clear();
      lockG.setVisible(usable);
      lockIcon.setVisible(usable);
      if (lockZone && lockZone.input) lockZone.input.enabled = usable;
      if (!usable) return;

      lockG.fillStyle(saved ? 0x2a2413 : 0x141c28, 0.95);
      lockG.fillRoundedRect(
        lockX - lockW / 2,
        lockY - lockH / 2,
        lockW,
        lockH,
        8
      );
      lockG.lineStyle(2, saved ? COLORS.gold : 0x3a4450, saved ? 0.9 : 0.6);
      lockG.strokeRoundedRect(
        lockX - lockW / 2,
        lockY - lockH / 2,
        lockW,
        lockH,
        8
      );
      lockIcon.setTint(saved ? COLORS.gold : 0x8fa3b0);
    };

    const paint = () => {
      const affordable = this.coins() >= item.price;

      g.clear();
      g.fillStyle(item.sold ? 0x101a16 : 0x0f1521, 0.97);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
      g.lineStyle(
        2,
        item.sold ? 0x39a05a : color,
        item.sold ? 0.5 : affordable ? 0.85 : 0.35
      );
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);

      coinIcon.setVisible(!item.sold).setAlpha(affordable ? 1 : 0.4);
      priceText
        .setVisible(!item.sold)
        .setText(String(item.price))
        .setColor(affordable ? hex : COLORS.dangerHex);
      soldText.setVisible(item.sold);

      paintTag();
      paintLock();
    };

    paint();

    const zone = this.add.zone(cx, cy, w, h).setInteractive();
    zone.on('pointerdown', () => this.buy(index));

    // Created after the card zone, so it wins the tap on top of it.
    lockZone = this.add.zone(lockX, lockY, lockW + 12 * s, lockH + 12 * s);
    lockZone.setInteractive();
    lockZone.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      this.toggleLock(index);
    });

    this.refs.push({ item, paint });
  }

  buy(index) {
    const run = this.run();
    if (!run || !run.buyShopItem) return;

    const item = (this.stock() || [])[index];

    // A full loadout asks which gun to give up instead of charging blindly.
    if (
      item &&
      item.kind === 'weapon' &&
      run.needsWeaponSlot(item.key, item.rarity)
    ) {
      this.replaceItem = { index };
      haptic('tick');
      this.rebuild();
      return;
    }

    if (!run.buyShopItem(index)) {
      haptic('tick');
      return;
    }

    haptic('impact');
    Sfx.buy();
    this.refresh();
  }

  refresh() {
    for (const ref of this.refs) ref.paint();
    if (this.coinText) this.coinText.setText(this.purse());
  }

  refreshItems() {
    const run = this.run();
    if (!run || !run.refreshShopItems) return;

    if (!run.refreshShopItems()) {
      haptic('tick');
      return;
    }

    haptic('impact');
    this.rebuild();
  }

  toggleLock(index) {
    const run = this.run();
    if (!run || !run.toggleShopLock) return;

    run.toggleShopLock(index);
    haptic('tick');
    this.refresh();
  }

  leave() {
    haptic('tick');
    const run = this.run();
    this.scene.stop();
    if (run && run.leaveShop) run.leaveShop();
  }
}
