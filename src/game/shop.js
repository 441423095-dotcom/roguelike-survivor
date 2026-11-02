// What the between-wave shop stocks: a shelf of odd items rolled from the item
// pool plus one weapon card drawn at one of the five rarity tiers, and a paid
// refresh. Weapons no longer drop in the arena — they are bought here.

import { ITEM_POOL, itemPrice } from './passives.js';
import { WEAPONS, WEAPON_SLOTS } from './weapons.js';
import { rollWeaponRarity, rarityDesc, weaponPrice } from './rarities.js';

export const SHOP_REFRESH_COST = 5;
export const SHOP_SLOTS = 4;

const ITEM_SLOTS = 3;

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

/// Only guns the run can actually take: a spare slot for something new, or an
/// upgrade for one already carried.
function rollWeapon(wave, loadout) {
  const weapons = loadout || [];
  const ownedKeys = weapons.map((slot) => slot.key);
  const hasFreeSlot = weapons.length < WEAPON_SLOTS;

  const pool = Object.keys(WEAPONS).filter((key) => {
    const index = ownedKeys.indexOf(key);
    if (index !== -1) return (weapons[index].level || 1) < 5;
    return hasFreeSlot;
  });

  if (pool.length === 0) return null;

  const key = pool[Math.floor(Math.random() * pool.length)];
  const def = WEAPONS[key];
  const rarity = rollWeaponRarity(wave);

  const owned = weapons.find((slot) => slot.key === key);
  const level = owned ? Math.min(5, (owned.level || 1) + 1) : 1;

  return {
    kind: 'weapon',
    key,
    rarity: rarity.key,
    rarityName: rarity.name,
    rank: rarity.rank,
    name: def.name,
    desc: rarityDesc(rarity),
    emoji: def.emoji,
    color: rarity.color,
    hex: rarity.hex,
    level,
    price: weaponPrice(key, rarity, wave),
    sold: false
  };
}

/// Rolls a shelf for this wave. `owned` is the run's item table, `loadout` the
/// carried weapons, so nothing at its cap or impossible to take is offered.
export function rollShopItems(wave, owned, loadout) {
  const stacks = owned || {};
  const weapon = rollWeapon(wave, loadout);
  const items = rollItems(wave, stacks, weapon ? ITEM_SLOTS : SHOP_SLOTS);

  if (weapon) items.push(weapon);
  return items;
}
