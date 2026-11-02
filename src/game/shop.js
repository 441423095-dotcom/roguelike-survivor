// What the between-wave shop stocks: a shelf of odd items rolled from the item
// pool, alternating gadgets and trinkets so a shelf is never all one kind, plus
// a paid refresh. Plain stat cards belong to the level-up choices, not here.

import { ITEM_POOL, itemPrice } from './passives.js';

export const SHOP_REFRESH_COST = 5;
export const SHOP_SLOTS = 4;

/// Rolls a shelf for this wave. `owned` is the run's item table, so anything
/// already at its stack cap is never offered again.
export function rollShopItems(wave, owned) {
  const stacks = owned || {};

  const available = ITEM_POOL.filter(
    (def) => (stacks[def.key] || 0) < (def.max || 1)
  );

  if (available.length === 0) return [];

  const chosen = [];
  const used = [];
  let wantActive = Math.random() < 0.5;

  for (let i = 0; i < SHOP_SLOTS; i++) {
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
