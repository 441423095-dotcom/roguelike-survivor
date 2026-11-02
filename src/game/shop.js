// What the between-wave shop stocks: three odd trinkets on the top shelf and
// two weapon cards under them, plus a paid refresh. Weapons no longer drop in
// the arena — they are bought here.

import { ITEM_POOL, itemPrice } from './passives.js';
import { WEAPONS, WEAPON_SLOTS } from './weapons.js';
import { rollWeaponRarity, rarityDesc, weaponName, weaponPrice } from './rarities.js';

export const SHOP_REFRESH_COST = 5;
export const ITEM_SLOTS = 3;
export const WEAPON_OFFERS = 2;
export const SHOP_SLOTS = ITEM_SLOTS + WEAPON_OFFERS;

function rollItems(wave, stacks, count) {
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
    const level = Math.min(def.max || 1, have + 1);

    return {
      kind: 'item',
      key: def.key,
      name: def.name,
      desc: def.desc(level),
      emoji: def.emoji,
      color: def.color,
      hex: def.hex,
      active: !!def.active,
      level,
      price: itemPrice(def, have, wave),
      sold: false
    };
  });
}

/// Weapon cards on the shelf. Duplicates are allowed, so two of the same gun at
/// the same tier can be collected and merged in the shop.
function rollWeapon(wave, loadout) {
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
  const rarity = rollWeaponRarity(wave);

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
    level: 1,
    price: weaponPrice(key, rarity, wave),
    sold: false
  };
}

/// Rolls a shelf for this wave. `owned` is the run's item table, `loadout` the
/// carried weapons, so nothing at its cap or impossible to take is offered. The
/// trinkets come first and the weapons after them, which is the order the shop
/// draws them in: items on the top shelf, weapons on the bottom one.
export function rollShopItems(wave, owned, loadout) {
  const stacks = owned || {};

  const weapons = [];
  for (let i = 0; i < WEAPON_OFFERS; i++) {
    const weapon = rollWeapon(wave, loadout);
    if (weapon) weapons.push(weapon);
  }

  const items = rollItems(wave, stacks, weapons.length > 0 ? ITEM_SLOTS : SHOP_SLOTS);

  return items.concat(weapons);
}
