// What the between-wave shop stocks: five trinkets on the top shelf and four
// weapon cards under them, plus a paid refresh. Every card's quality is rolled
// from the wave's curve, so a deep run is offered real upgrades instead of a
// rack of white guns.

import { ITEM_POOL, itemPrice, shopDiscount } from './passives.js';
import { WEAPONS, WEAPON_SLOTS } from './weapons.js';
import {
  rollWeaponRarity,
  rarityDesc,
  shelfFloor,
  weaponLevel,
  weaponName,
  weaponPrice
} from './rarities.js';

export const SHOP_REFRESH_COST = 5;
// Four of each on the shelf: fewer cards means taller ones, so every card has
// room to show its whole intro.
export const ITEM_SLOTS = 4;
export const WEAPON_OFFERS = 4;
export const SHOP_SLOTS = ITEM_SLOTS + WEAPON_OFFERS;

function roundPrice(value) {
  return Math.max(10, Math.round(value / 5) * 5);
}

function rollItems(wave, stacks, count, discount, quality = wave) {
  const available = ITEM_POOL.filter(
    (def) => (stacks[def.key] || 0) < (def.max || 1)
  );

  if (available.length === 0) return [];

  const chosen = [];
  const used = [];
  let wantActive = Math.random() < 0.5;

  for (let i = 0; i < count; i++) {
    let pool = available.filter(
      (def) => !!def.active === wantActive && used.indexOf(def.key) === -1
    );

    // Fall back to the other kind, then to a repeat, then to anything left.
    if (pool.length === 0) {
      pool = available.filter((def) => used.indexOf(def.key) === -1);
    }
    if (pool.length === 0) {
      pool = available.filter((def) => !!def.active === wantActive);
    }
    if (pool.length === 0) pool = available;

    const def = pool[Math.floor(Math.random() * pool.length)];
    used.push(def.key);
    chosen.push(def);

    wantActive = !wantActive;
  }

  return chosen.map((def) => {
    const have = stacks[def.key] || 0;
    const max = def.max || 1;
    const rarity = rollWeaponRarity(quality);

    // A blue-or-better trinket card hands over two stacks at once: an honest
    // upgrade at the point where one more copy of a flat item is worth little.
    const bonus = rarity.rank >= 2 ? 2 : 1;
    const take = Math.max(1, Math.min(max - have, bonus));
    const level = Math.min(max, have + take);
    // Two stacks in one card are cheaper than buying the copies one by one, and
    // a better tier of a trinket costs a little more on top.
    const basePrice = roundPrice(
      itemPrice(def, have, wave) * (1 + 0.6 * (take - 1)) * (1 + 0.1 * rarity.rank)
    );

    return {
      kind: 'item',
      key: def.key,
      name: def.name,
      desc: def.desc(level),
      emoji: def.emoji,
      color: def.color,
      hex: def.hex,
      active: !!def.active,
      rarity: rarity.key,
      rarityName: rarity.name,
      rank: rarity.rank,
      stacks: take,
      level,
      basePrice,
      // 打折券 takes its slice off the whole shelf.
      price: roundPrice(basePrice * discount),
      locked: false,
      sold: false
    };
  });
}

/// Weapon cards on the shelf. Duplicates are allowed, so two of the same gun at
/// the same tier can be collected and merged in the shop.
function rollWeapon(wave, loadout, minRank = 0, quality = wave) {
  const weapons = loadout || [];
  const hasFreeSlot = weapons.length < WEAPON_SLOTS;

  const pool = Object.keys(WEAPONS).filter((key) => {
    if (weapons.length === 0) return true;
    if (hasFreeSlot) return true;
    return weapons.some((slot) => slot.key === key);
  });

  if (pool.length === 0) return null;

  const key = pool[Math.floor(Math.random() * pool.length)];
  const def = WEAPONS[key];
  const rarity = rollWeaponRarity(quality, minRank);
  const level = weaponLevel(wave);

  return {
    kind: 'weapon',
    key,
    rarity: rarity.key,
    rarityName: rarity.name,
    rank: rarity.rank,
    name: weaponName(def, rarity.key),
    desc: def.note ? `${rarityDesc(rarity)} · ${def.note}` : rarityDesc(rarity),
    emoji: def.emoji,
    color: rarity.color,
    hex: rarity.hex,
    level,
    basePrice: weaponPrice(key, rarity, wave, level),
    price: weaponPrice(key, rarity, wave, level),
    locked: false,
    sold: false
  };
}

/// Rolls a shelf for this wave. `owned` is the run's item table, `loadout` the
/// carried weapons, so nothing at its cap or impossible to take is offered. The
/// trinkets come first and the weapons after them, which is the order the shop
/// draws them in: items on the top shelf, weapons below them.
export function rollShopItems(wave, owned, loadout, luck = 0) {
  const stacks = owned || {};
  const discount = shopDiscount(stacks);
  // 幸运 nudges the whole shelf's quality, as if the run were a little deeper.
  const quality = wave + Math.max(0, luck) * 0.5;

  const weapons = [];
  for (let i = 0; i < WEAPON_OFFERS; i++) {
    const weapon = rollWeapon(wave, loadout, 0, quality);
    if (!weapon) continue;
    weapon.price = roundPrice(weapon.basePrice * discount);
    weapons.push(weapon);
  }

  // From wave five on, every visit is guaranteed one gun at the shelf's floor:
  // a blue card at five, a purple at nine, a gold at fourteen.
  const floor = shelfFloor(wave);
  if (floor > 0 && weapons.length > 0) {
    const best = weapons.reduce((top, weapon) => Math.max(top, weapon.rank), -1);
    if (best < floor) {
      const slot = Math.floor(Math.random() * weapons.length);
      const forced = rollWeapon(wave, loadout, floor, quality);
      if (forced) {
        forced.price = roundPrice(forced.basePrice * discount);
        weapons[slot] = forced;
      }
    }
  }

  const items = rollItems(
    wave,
    stacks,
    weapons.length > 0 ? ITEM_SLOTS : SHOP_SLOTS,
    discount,
    quality
  );

  return items.concat(weapons);
}
