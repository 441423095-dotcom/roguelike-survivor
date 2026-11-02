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
import { WEAPONS, WEAPON_SLOTS, weaponDef, weaponStats } from '../game/weapons.js';
import { nextRarity, rarityFor, weaponName } from '../game/rarities.js';
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
    this.pickedSlot = null;
    this.busy = false;
    this.detailIndex = null;
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

  /// A note in the header while 打折券 is working, so a cheaper shelf is
  /// explained rather than looking like a bug.
  discountNote() {
    const run = this.run();
    const coupons = run && run.items ? run.items.coupon || 0 : 0;
    return coupons > 0 ? ` · 打折中 -${coupons * 15}%` : '';
  }

  /// What the next re-roll costs right now: it climbs with every refresh in
  /// this visit and 会员卡 takes its slice off.
  refreshCost() {
    const run = this.run();
    if (run && run.refreshCost) return run.refreshCost();
    return SHOP_REFRESH_COST;
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
        `第 ${this.wave} 波结束 · 上面是道具，下面是武器${this.discountNote()}`,
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
      label: `刷新 ${this.refreshCost()}`,
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

    // Cards, in two shelves between the header and the continue button.
    const cardW = Math.min(W - 32, 430 * s);
    const gap = Math.round(8 * s);
    const labelH = Math.round(17 * s);

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
    // The gear strip grows taller while a gun is being replaced, so the shelf
    // above it has to give up that room rather than be drawn over.
    const areaBottom = H - (this.replaceItem ? 212 : 182) * s;

    // Trinkets on the top shelf, weapons under them, both in a two-column grid:
    // eight cards leave each one tall enough to show its whole intro, and every
    // price sits at the right of its own cell.
    const entries = items.map((item, index) => ({ item, index }));
    const trinkets = entries.filter((entry) => entry.item.kind !== 'weapon');
    const guns = entries.filter((entry) => entry.item.kind === 'weapon');

    const shelves = [];
    if (trinkets.length > 0) {
      shelves.push({ label: `道具 · ${trinkets.length}`, cards: trinkets });
    }
    if (guns.length > 0) {
      shelves.push({ label: `武器 · ${guns.length}`, cards: guns });
    }

    const colGap = Math.round(8 * s);
    const cellW = (cardW - colGap) / 2;
    const rowsFor = (count) => Math.ceil(count / 2);
    const totalRows = shelves.reduce(
      (sum, shelf) => sum + rowsFor(shelf.cards.length),
      0
    );

    const rowGap = Math.round(7 * s);
    const avail = Math.max(200, areaBottom - areaTop);
    // The floor is low on purpose: a short phone shrinks the cards instead of
    // letting the last row slide under the gear strip below it.
    const cellH = Math.max(
      40,
      Math.min(
        100 * s,
        (avail - labelH * shelves.length - rowGap * (totalRows + shelves.length)) /
          Math.max(1, totalRows)
      )
    );

    let y = areaTop;

    shelves.forEach((shelf) => {
      this.add
        .text(W / 2 - cardW / 2 + 4 * s, y + labelH / 2, shelf.label, {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: COLORS.dim,
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
        .setDepth(2);
      y += labelH;

      shelf.cards.forEach((entry, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const cx = W / 2 - cardW / 2 + cellW / 2 + col * (cellW + colGap);
        const cy = y + row * (cellH + rowGap) + cellH / 2;
        this.buildCard(entry.item, entry.index, cx, cy, cellW, cellH, s);
      });

      const rows = rowsFor(shelf.cards.length);
      y += rows * cellH + (rows - 1) * rowGap + rowGap;
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

  /// One carried gun as a thumb-sized button: rarity ring, picture, name and
  /// level. `highlight` paints it as the one picked for a swap.
  buildWeaponChip(slot, index, opt) {
    const { cx, cy, width, height, radius, nameSize, levelSize, highlight } =
      opt;
    const s = opt.s;
    const def = weaponDef(slot);
    const rarity = rarityFor(slot.rarity || 'common');

    const g = this.add.graphics().setDepth(3);
    g.fillStyle(highlight ? 0x2a2413 : 0x0d1522, 0.96);
    g.fillRoundedRect(cx - width / 2, cy - height / 2, width, height, 10);
    g.lineStyle(
      highlight ? 3 : 2,
      highlight ? 0xffd166 : rarity.color,
      highlight ? 1 : 0.6
    );
    g.strokeRoundedRect(cx - width / 2, cy - height / 2, width, height, 10);

    const iconY = cy - height / 2 + 5 * s + radius;
    g.fillStyle(0x05080d, 0.9);
    g.fillCircle(cx, iconY, radius);
    g.lineStyle(2, rarity.color, 1);
    g.strokeCircle(cx, iconY, radius);

    this.add
      .text(cx, iconY, def ? def.emoji : '🔫', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(radius * 1.3)}px`
      })
      .setOrigin(0.5)
      .setDepth(4);

    const nameY = iconY + radius + 3 * s;
    this.add
      .text(cx, nameY, weaponName(def, slot.rarity), {
        fontFamily: FONT,
        fontSize: `${Math.max(8, Math.round(nameSize))}px`,
        color: highlight ? COLORS.goldHex : rarity.hex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5, 0)
      .setDepth(4);

    this.add
      .text(cx, nameY + nameSize + 2 * s, `Lv${slot.level || 1}`, {
        fontFamily: FONT,
        fontSize: `${Math.max(7, Math.round(levelSize))}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5, 0)
      .setDepth(4);

    const zone = this.add.zone(cx, cy, width, height).setInteractive();
    zone.on('pointerdown', () => this.tapWeapon(index));
  }

  /// The replace view: the three guns side by side and named, with the picked
  /// one lit up in gold. A second tap on that same gun confirms the swap.
  buildReplaceStrip(run, x, top, barW, barH, s) {
    const pending = (this.stock() || [])[this.replaceItem.index];
    const pendingName = pending ? pending.name : '新武器';
    const price = pending ? pending.price : 0;
    const affordable = this.coins() >= price;
    const picked = run.state.weapons[this.pickedSlot];

    const headY = top + 13 * s;
    const head = picked
      ? `再点一次「${weaponName(weaponDef(picked), picked.rarity)}」换上`
      : affordable
        ? `换下哪一把？${pendingName} · ${price} 金币`
        : `金币不够：${pendingName} 要 ${price}`;

    this.add
      .text(x + 10 * s, headY, head, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: picked
          ? COLORS.goldHex
          : affordable
            ? COLORS.ink
            : COLORS.dangerHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    this.add
      .text(x + barW - 10 * s, headY, '取消', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(1, 0.5)
      .setDepth(3)
      .setInteractive()
      .on('pointerdown', () => {
        this.replaceItem = null;
        this.pickedSlot = null;
        haptic('tick');
        this.scheduleRebuild();
      });

    const weapons = run.state.weapons.slice(0, WEAPON_SLOTS);
    const count = Math.max(1, weapons.length);
    const gap = 8 * s;
    const usableW = barW - 20 * s;
    const chipTop = top + 24 * s;
    const chipH = top + barH - 8 * s - chipTop;
    const chipW = (usableW - gap * (count - 1)) / count;

    weapons.forEach((slot, index) => {
      this.buildWeaponChip(slot, index, {
        cx: x + 10 * s + chipW / 2 + index * (chipW + gap),
        cy: chipTop + chipH / 2,
        width: chipW,
        height: chipH,
        radius: Math.min(16 * s, chipH * 0.28),
        nameSize: 10 * s,
        levelSize: 9 * s,
        highlight: this.pickedSlot === index,
        s
      });
    });
  }

  /// The gear strip under the shelves. Normally it lists the carried guns on
  /// the left and the trinkets on the right; in replace mode it hands the whole
  /// strip to the guns, named and levelled, so there is never a doubt about
  /// which one is going out.
  buildOwnedBar(W, H, s) {
    const run = this.run();
    if (!run || !run.state) return;

    const replacing = !!this.replaceItem;
    const barW = Math.min(W - 24, 430 * s);
    const barH = Math.round((replacing ? 104 : 80) * s);
    const x = (W - barW) / 2;
    const y = H - (replacing ? 150 : 138) * s;

    const g = this.add.graphics().setDepth(2);
    // Fully opaque: on a very short screen the shelf shrinks but never slides
    // under this strip, and nothing shows through it either way.
    g.fillStyle(0x0b1018, 1);
    g.fillRoundedRect(x, y - barH / 2, barW, barH, 12);
    g.lineStyle(2, replacing ? 0xffd166 : 0x2bd3c4, replacing ? 0.85 : 0.3);
    g.strokeRoundedRect(x, y - barH / 2, barW, barH, 12);

    if (replacing) {
      this.buildReplaceStrip(run, x, y - barH / 2, barW, barH, s);
      return;
    }

    // Split the strip in half with a hairline.
    g.lineStyle(1, 0x2bd3c4, 0.18);
    g.lineBetween(x + barW / 2, y - barH / 2 + 8 * s, x + barW / 2, y + barH / 2 - 8 * s);

    const labelY = y - barH / 2 + 12 * s;

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

    // Weapons, left half: an emoji chip each with its level on the rim. The
    // full name and numbers live in the sheet a tap opens, so five guns fit.
    const weapons = run.state.weapons.slice(0, WEAPON_SLOTS);
    const chipY = y + 8 * s;
    const chipR = Math.min(15 * s, barH * 0.22);
    const step = Math.min(
      chipR * 2 + 12 * s,
      (barW / 2 - 26 * s) / Math.max(1, weapons.length)
    );

    weapons.forEach((slot, index) => {
      const cx = x + 22 * s + index * step;
      const def = weaponDef(slot);
      const rarity = rarityFor(slot.rarity || 'common');

      g.fillStyle(0x0d1522, 0.9);
      g.fillCircle(cx, chipY, chipR);
      g.lineStyle(2, rarity.color, 0.9);
      g.strokeCircle(cx, chipY, chipR);

      this.add
        .text(cx, chipY - 1 * s, def ? def.emoji : '🔫', {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: `${Math.round(chipR * 1.1)}px`
        })
        .setOrigin(0.5)
        .setDepth(3);

      this.add
        .text(cx + chipR * 0.62, chipY + chipR * 0.62, `${slot.level || 1}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(9 * s)}px`,
          color: COLORS.goldHex,
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setDepth(4);

      const zone = this.add
        .zone(cx, chipY, chipR * 2 + 6, chipR * 2 + 6)
        .setInteractive();
      zone.on('pointerdown', () => this.tapWeapon(index));
    });

    const r = Math.max(11, Math.round(14 * s));

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

  /// Tapping a carried gun opens its sheet. In replace mode the first tap picks
  /// the gun and a second tap on the same one confirms, so the swap is never a
  /// guess about which slot is about to change.
  tapWeapon(index) {
    const run = this.run();
    if (!run || !run.state) return;

    if (this.replaceItem) {
      if (this.pickedSlot === index) {
        this.confirmReplace(index);
        return;
      }

      this.pickedSlot = index;
      haptic('tick');
      this.scheduleRebuild();
      return;
    }

    const slot = run.state.weapons[index];
    if (!slot) return;

    const def = weaponDef(slot);

    this.openSell({
      kind: 'weapon',
      index,
      name: weaponName(def, slot.rarity),
      price: run.weaponSellPrice(slot),
      desc: this.weaponDetail(slot)
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
      price: run.itemSellPrice(key),
      desc: def.desc(this.owned(key) || 1)
    });
  }

  /// Performs the swap the player picked, charging only once it has landed.
  confirmReplace(slotIndex) {
    const pending = this.replaceItem;
    const run = this.run();
    if (!pending || !run || !run.replaceWeaponSlot) return;

    const item = (this.stock() || [])[pending.index];
    if (!item || item.sold) {
      this.replaceItem = null;
      this.pickedSlot = null;
      this.scheduleRebuild();
      return;
    }

    if (this.coins() < item.price) {
      this.toast(`金币不够：${item.name} 要 ${item.price}`);
      haptic('tick');
      return;
    }

    let swapped = false;
    try {
      swapped = run.replaceWeaponSlot(slotIndex, pending.index) === true;
    } catch (error) {
      console.warn('Weapon replace failed:', error);
    }

    if (!swapped) {
      this.toast('替换失败，再试一次');
      haptic('tick');
      return;
    }

    this.replaceItem = null;
    this.pickedSlot = null;
    haptic('impact');
    Sfx.buy();
    this.scheduleRebuild();
  }

  /// The small sheet for one owned weapon or item: pay to push a gun up a
  /// rarity tier, sell it back for coins, or keep it. Nothing is automatic.
  openSell(target) {
    this.sellTarget = target;

    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const s = computeLayout(W, H).uiScale;

    const panelW = Math.min(W - 60, 320 * s);
    const panelH = Math.round(246 * s);
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

    // A tap on the sheet itself does nothing; only the dim edge closes it, so
    // a button underneath the overlay always keeps its own tap.
    this.add
      .zone(cx, cy, panelW, panelH)
      .setDepth(21)
      .setInteractive()
      .on('pointerdown', () => {});

    this.add
      .text(cx, cy - panelH / 2 + 26 * s, target.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(22);

    // Only fusing two identical guns raises a tier; money cannot buy one, so
    // the sheet says so instead of offering an upgrade.
    this.add
      .text(
        cx,
        cy - panelH / 2 + 54 * s,
        target.kind === 'weapon'
          ? '只能靠合成两把同品质武器来升阶'
          : '卖掉会让它彻底离开这一局',
        {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.dim
        }
      )
      .setOrigin(0.5)
      .setDepth(22);

    this.add
      .text(cx, cy - panelH / 2 + 78 * s, `出售返还 ${target.price} 金币`, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.goldHex
      })
      .setOrigin(0.5)
      .setDepth(22);

    // The full detail line, so an owned gun can be inspected as well as sold.
    if (target.desc) {
      const sellDesc = this.add
        .text(cx, cy - panelH / 2 + 104 * s, '', {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: '#d6e3ee',
          align: 'center',
          wordWrap: { width: panelW - 30 * s, useAdvancedWrap: true },
          lineSpacing: Math.round(3 * s)
        })
        .setOrigin(0.5, 0)
        .setDepth(22);

      this.fitLines(sellDesc, target.desc, 3);
    }

    // Sell it or keep it — the choice is always the player's.
    const actions = [];
    actions.push({
      label: `出售 ${target.price}`,
      accent: COLORS.gold,
      onPress: () => this.confirmSell()
    });
    actions.push({
      label: '取消',
      accent: 0x2bd3c4,
      onPress: () => this.closeSell()
    });

    const buttonY = cy + panelH / 2 - 34 * s;
    const sideGap = 10 * s;
    const buttonW = (panelW - sideGap * (actions.length + 1)) / actions.length;

    actions.forEach((action, index) => {
      makeButton(this, {
        x: cx - panelW / 2 + sideGap * (index + 1) + buttonW * (index + 0.5),
        y: buttonY,
        width: buttonW,
        height: Math.round(36 * s),
        label: action.label,
        fontSize: Math.round(12 * s),
        accent: action.accent,
        depth: 22,
        onPress: action.onPress
      });
    });

    sharpenText(this);
  }

  closeSell() {
    this.sellTarget = null;
    this.scheduleRebuild();
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
    this.scheduleRebuild();
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
      label: '免费合成',
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
    this.scheduleRebuild();
  }

  buildCard(item, index, cx, cy, w, h, s) {
    const rarity = rarityFor(item.rarity || 'common');
    // The border is the tier: white, green, blue, purple, gold. Nothing else on
    // the card has to spell the quality out.
    const color = rarity.color;
    const hex = rarity.hex;

    const g = this.add.graphics().setDepth(2);

    // Rarer cards glow behind the border, so a blue pull reads as one.
    if (item.rank >= 2) {
      const spread = 3 + item.rank * 2;
      const glow = this.add.graphics().setDepth(1);
      glow.fillStyle(rarity.color, 0.08 + item.rank * 0.04);
      glow.fillRoundedRect(
        cx - w / 2 - spread,
        cy - h / 2 - spread,
        w + spread * 2,
        h + spread * 2,
        16
      );
      glow.lineStyle(3, rarity.color, 0.2 + item.rank * 0.07);
      glow.strokeRoundedRect(
        cx - w / 2 - spread,
        cy - h / 2 - spread,
        w + spread * 2,
        h + spread * 2,
        16
      );
    }

    const left = cx - w / 2;
    const top = cy - h / 2;
    const right = cx + w / 2;
    const bottom = cy + h / 2;

    // A lock in the top-right corner: pin a card so it survives the next
    // re-roll and is still here in the next wave's shop.
    const lockSize = Math.round(18 * s);
    const lockX = right - 8 * s - lockSize / 2;
    const lockY = top + 8 * s + lockSize / 2;

    const lockG = this.add.graphics().setDepth(4);
    const lockIcon = this.add
      .image(lockX, lockY, 'icon-lock')
      .setDisplaySize(lockSize * 0.8, lockSize * 0.8)
      .setDepth(5);

    // The price is pinned to the bottom-right corner of the cell, whatever the
    // text above it does.
    const priceX = right - 9 * s;
    const priceY = bottom - 11 * s;

    const coinIcon = this.add
      .image(priceX - 24 * s, priceY, 'coin')
      .setDisplaySize(11 * s, 11 * s)
      .setDepth(3);

    const priceText = this.add
      .text(priceX, priceY, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: hex,
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(3);

    const soldText = this.add
      .text(priceX, priceY, '已购买', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(3)
      .setVisible(false);

    const iconSize = Math.min(19 * s, h * 0.3);
    const iconX = left + 9 * s + iconSize / 2;
    const iconY = top + 10 * s + iconSize / 2;

    this.add
      .text(iconX, iconY, item.emoji || '❓', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(iconSize * 0.95)}px`
      })
      .setOrigin(0.5)
      .setDepth(3);

    const textX = iconX + iconSize / 2 + 6 * s;

    this.add
      .text(textX, iconY, item.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(13 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold',
        stroke: '#04070c',
        strokeThickness: Math.max(2, Math.round(2.5 * s))
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    // The intro wraps by character (Chinese has no spaces to break on) and is
    // trimmed with an ellipsis if it needs more lines than the card can show.
    const descText = this.add
      .text(
        left + 9 * s,
        top + 27 * s,
        '',
        {
          fontFamily: FONT,
          fontSize: `${Math.round(11 * s)}px`,
          color: '#d6e3ee',
          wordWrap: { width: Math.max(60, w - 18 * s), useAdvancedWrap: true },
          lineSpacing: Math.round(1 * s)
        }
      )
      .setOrigin(0, 0)
      .setDepth(3);

    const descLineH = Math.max(10, Math.round(11.5 * s));
    const descLines = Math.max(
      1,
      Math.min(2, Math.floor((h - 30 * s) / descLineH))
    );
    this.fitLines(
      descText,
      item.kind === 'weapon'
        ? `Lv${item.level || 1} · ${item.desc}`
        : item.desc,
      descLines
    );

    const paintLock = () => {
      const locked = !!item.locked;
      const usable = !item.sold;

      lockG.clear();
      lockG.setVisible(usable);
      lockIcon.setVisible(usable);
      if (!usable) return;

      lockG.fillStyle(locked ? 0x3a2f10 : 0x141c28, locked ? 1 : 0.8);
      lockG.fillRoundedRect(
        lockX - lockSize / 2,
        lockY - lockSize / 2,
        lockSize,
        lockSize,
        6
      );
      lockG.lineStyle(2, locked ? COLORS.gold : 0x3a4450, locked ? 1 : 0.5);
      lockG.strokeRoundedRect(
        lockX - lockSize / 2,
        lockY - lockSize / 2,
        lockSize,
        lockSize,
        6
      );
      lockIcon.setTint(locked ? COLORS.gold : 0x8fa3b0);
    };

    const paint = () => {
      const affordable = this.coins() >= item.price;
      const locked = !!item.locked;

      g.clear();
      g.fillStyle(item.sold ? 0x101a16 : 0x0f1521, 0.97);
      g.fillRoundedRect(left, top, w, h, 12);
      g.lineStyle(
        2,
        item.sold ? 0x39a05a : locked ? COLORS.gold : color,
        item.sold ? 0.5 : locked ? 0.95 : affordable ? 0.85 : 0.35
      );
      g.strokeRoundedRect(left, top, w, h, 12);

      priceText
        .setVisible(!item.sold)
        .setText(String(item.price))
        .setColor(affordable ? hex : COLORS.dangerHex);
      coinIcon.setVisible(!item.sold).setAlpha(affordable ? 1 : 0.4);
      // Keep the coin hugging whatever width the number ended up being.
      coinIcon.x = priceX - priceText.width - 7 * s;

      soldText.setVisible(item.sold);

      descText.setVisible(!item.sold && h >= 40 * s);

      paintLock();
    };

    paint();

    // Pressing a card opens its details; buying happens from there, so a stray
    // tap can never spend coins by accident.
    const zone = this.add.zone(cx, cy, w, h).setInteractive();
    zone.on('pointerdown', () => this.openDetail(index));

    // Created after the card's own zone, so a tap on the lock pins the card
    // instead of buying it.
    const lockZone = this.add
      .zone(lockX, lockY, lockSize + 12 * s, lockSize + 12 * s)
      .setInteractive();
    lockZone.on('pointerdown', () => this.toggleLock(index));

    this.refs.push({ item, paint });
  }

  /// Phaser's basic wrap never breaks a Chinese sentence (there are no spaces
  /// to break on), which is what let long card text run over the border. This
  /// measures the wrapped height and, if it still needs more lines than the card
  /// can show, trims it and ends it with an ellipsis.
  fitLines(label, text, maxLines) {
    label.setText('M');
    const lineH = Math.max(1, label.height);

    label.setText(text);
    let shown = text;
    let guard = 0;

    while (label.height > lineH * maxLines + 1 && shown.length > 1 && guard++ < 200) {
      shown = shown.slice(0, -1);
      label.setText(`${shown}…`);
    }
  }

  /// Pins or unpins a card. A locked card stays on the shelf through a refresh
  /// and through the next wave's shop until it is bought.
  toggleLock(index) {
    const run = this.run();
    const item = (this.stock() || [])[index];
    if (!run || !run.toggleShopLock || !item || item.sold) return;

    const locked = run.toggleShopLock(index);
    haptic('tick');

    // Repaint just this card: a full rebuild would wipe the toast that says
    // what just happened.
    const ref = this.refs.find((entry) => entry.item === item);
    if (ref) ref.paint();

    this.toast(locked ? `已锁定：${item.name}` : `已解锁：${item.name}`);
  }

  /// The numbers a gun is actually shooting at, plus its flavour line.
  weaponDetail(slot) {
    const run = this.run();
    const def = weaponDef(slot);
    if (!def) return '';

    const parts = [];
    if (run && run.state) {
      const stats = weaponStats(slot, run.state);
      if (stats) {
        parts.push(`伤害 ${Math.round(stats.damage)}`);
        parts.push(`间隔 ${(stats.interval / 1000).toFixed(2)} 秒`);
        parts.push(`射程 ${Math.round(stats.range)}`);
        if (stats.pierce) parts.push(`穿透 ${stats.pierce}`);
      }
    }
    if (def.note) parts.push(def.note);
    return parts.join(' · ');
  }

  /// One line for the second row of a card's sheet: level for a gun, kind and
  /// stack count for a trinket.
  itemGrade(item) {
    if (item.kind === 'weapon') return `Lv${item.level || 1}`;
    const stacks = Math.max(1, item.stacks || 1);
    return `${item.active ? '主动' : '被动'}${stacks > 1 ? ` ×${stacks}` : ''}`;
  }

  /// Everything the card does, for the detail sheet.
  itemDetail(item) {
    if (item.kind === 'weapon') {
      return this.weaponDetail({
        key: item.key,
        level: item.level || 1,
        rarity: item.rarity
      });
    }
    return item.desc;
  }

  /// Pressing a card shows what it is before any money moves: full description,
  /// live numbers for a gun, price, and the buy / lock / close buttons.
  openDetail(index) {
    const item = (this.stock() || [])[index];
    if (!item || item.sold) return;

    this.detailIndex = index;

    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const s = computeLayout(W, H).uiScale;
    const rarity = rarityFor(item.rarity || 'common');

    const panelW = Math.min(W - 40, 340 * s);
    const panelH = Math.round(250 * s);
    const cx = W / 2;
    const cy = H / 2;
    const left = cx - panelW / 2;
    const top = cy - panelH / 2;

    const dim = this.add
      .rectangle(cx, cy, W, H, 0x05080d, 0.72)
      .setDepth(20)
      .setInteractive();
    dim.on('pointerdown', () => this.closeDetail());

    const panel = this.add.graphics().setDepth(21);
    panel.fillStyle(0x0d1522, 0.99);
    panel.fillRoundedRect(left, top, panelW, panelH, 16);
    panel.lineStyle(2, rarity.color, 0.55);
    panel.strokeRoundedRect(left, top, panelW, panelH, 16);

    // A tap on the sheet itself does nothing; only the dim edge closes it, so
    // the buy / lock / close buttons always keep their own taps.
    this.add
      .zone(cx, cy, panelW, panelH)
      .setDepth(21)
      .setInteractive()
      .on('pointerdown', () => {});

    this.add
      .text(left + 18 * s, top + 32 * s, item.emoji || '❓', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(26 * s)}px`
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    this.add
      .text(left + 58 * s, top + 26 * s, item.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(18 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    this.add
      .text(left + 58 * s, top + 48 * s, `${rarity.name} · ${this.itemGrade(item)}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: rarity.hex
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    const detailText = this.add
      .text(left + 18 * s, top + 70 * s, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: '#d6e3ee',
        wordWrap: { width: panelW - 36 * s, useAdvancedWrap: true },
        lineSpacing: Math.round(3 * s)
      })
      .setOrigin(0, 0)
      .setDepth(22);

    this.fitLines(detailText, this.itemDetail(item), 5);

    this.add
      .image(left + 26 * s, cy + panelH / 2 - 62 * s, 'coin')
      .setDisplaySize(14 * s, 14 * s)
      .setDepth(22);
    this.add
      .text(left + 38 * s, cy + panelH / 2 - 62 * s, String(item.price), {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * s)}px`,
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    const full = this.blockReason(index) === 'full';
    const actions = [
      {
        label: full ? '更换…' : `购买 ${item.price}`,
        accent: COLORS.gold,
        onPress: () => {
          this.detailIndex = null;
          this.buy(index);
        }
      },
      {
        label: item.locked ? '解锁' : '锁定',
        accent: 0xffd166,
        onPress: () => {
          const locked = this.run().toggleShopLock(index);
          this.detailIndex = null;
          haptic('tick');
          this.toast(locked ? `已锁定：${item.name}` : `已解锁：${item.name}`);
          this.scheduleRebuild();
        }
      },
      {
        label: '关闭',
        accent: 0x2bd3c4,
        onPress: () => this.closeDetail()
      }
    ];

    const sideGap = 10 * s;
    const buttonW = (panelW - sideGap * (actions.length + 1)) / actions.length;
    actions.forEach((action, i) => {
      makeButton(this, {
        x: left + sideGap * (i + 1) + buttonW * (i + 0.5),
        y: cy + panelH / 2 - 30 * s,
        width: buttonW,
        height: Math.round(38 * s),
        label: action.label,
        fontSize: Math.round(12 * s),
        accent: action.accent,
        depth: 22,
        onPress: action.onPress
      });
    });

    sharpenText(this);
  }

  closeDetail() {
    this.detailIndex = null;
    this.scheduleRebuild();
  }

  /// Why a card cannot be bought right now: '' when it can, otherwise a code
  /// the shop turns into a sentence. Nothing is charged before this passes.
  blockReason(index) {
    const run = this.run();
    const item = (this.stock() || [])[index];

    if (!run || !run.state || !item || item.sold) return 'gone';
    if (this.coins() < item.price) return 'coins';

    if (item.kind === 'item') {
      const def = ITEM_BY_KEY[item.key];
      const stacks = Math.max(1, item.stacks || 1);
      if (!def || this.owned(item.key) + stacks > (def.max || 1)) return 'max';
    }

    if (item.kind === 'weapon') {
      const same =
        run.weaponMergeIndex &&
        run.weaponMergeIndex(item.key, item.rarity) >= 0;
      if (!same && run.state.weapons.length >= WEAPON_SLOTS) return 'full';
    }

    return '';
  }

  /// A short line so a tap that does not go through always says why instead of
  /// looking dead.
  toast(text) {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const s = computeLayout(W, H).uiScale;

    const label = this.add
      .text(W / 2, H * 0.56, text, {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * s)}px`,
        color: '#ffd166',
        fontStyle: 'bold',
        backgroundColor: '#1a1424',
        padding: { x: Math.round(10 * s), y: Math.round(6 * s) }
      })
      .setOrigin(0.5)
      .setDepth(31);

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 900,
      duration: 260,
      onComplete: () => label.destroy()
    });
  }

  /// A shop re-renders, it does not tear itself down inside the tap that asked
  /// for it: rebuilding on the next tick keeps every tap after it alive.
  scheduleRebuild() {
    this.busy = true;

    this.time.delayedCall(0, () => {
      this.busy = false;
      if (this.scene && this.scene.isActive() && this.children) this.rebuild();
    });
  }

  buy(index) {
    const run = this.run();
    if (!run || !run.buyShopItem || this.busy) return;

    const item = (this.stock() || [])[index];
    if (!item) return;

    const reason = this.blockReason(index);

    // A full loadout does not fail: it asks which gun to give up instead.
    if (reason === 'full') {
      if (this.coins() < item.price) {
        this.toast(`金币不够：${item.name} 要 ${item.price}`);
        haptic('tick');
        return;
      }

      this.replaceItem = { index };
      this.pickedSlot = null;
      haptic('tick');
      this.scheduleRebuild();
      return;
    }

    if (reason === 'coins') {
      this.toast(`金币不够：${item.name} 要 ${item.price}`);
      haptic('tick');
      return;
    }

    if (reason === 'max') {
      this.toast('这件道具已经拿满了');
      haptic('tick');
      return;
    }

    if (reason) return;

    let bought = false;
    try {
      bought = run.buyShopItem(index) === true;
    } catch (error) {
      console.warn('Shop purchase failed:', error);
    }

    if (!bought) {
      this.toast('没能买下，再试一次');
      haptic('tick');
      return;
    }

    haptic('impact');
    Sfx.buy();

    // A full re-render, not just a repaint: the gear strip has to show what was
    // just bought, which is how the player knows it is in the bag.
    this.scheduleRebuild();
  }

  refreshItems() {
    const run = this.run();
    if (!run || !run.refreshShopItems) return;

    const cost = this.refreshCost();

    if (!run.refreshShopItems()) {
      this.toast(`刷新要 ${cost} 金币`);
      haptic('tick');
      return;
    }

    haptic('impact');
    this.scheduleRebuild();
  }

  leave() {
    haptic('tick');
    const run = this.run();
    this.scene.stop();
    if (run && run.leaveShop) run.leaveShop();
  }
}
