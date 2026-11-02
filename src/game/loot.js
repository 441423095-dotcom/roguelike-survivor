// Pacing: how much experience one level costs, and which weapons the floor is
// allowed to hand out at this point in the run.

import { WEAPONS } from './weapons.js';

// Which bracket of the arsenal each gun belongs to. The starter guns are tier
// one; the big ones only start appearing once the run is deep enough to answer
// them.
const WEAPON_TIERS = {
  blaster: 1,
  smg: 1,
  shotgun: 2,
  piercer: 2,
  frost: 2,
  venom: 3,
  disc: 3,
  laser: 3,
  sniper: 4,
  rocket: 4
};

/// The experience one level costs at this wave. It is rebuilt on every level-up
/// and never shrinks when a wave starts, so a run settles at roughly one level
/// per wave — and on the hard waves, often not even that.
export function xpForLevel(wave) {
  const w = Math.max(1, wave);
  return Math.round(30 + 22 * (w - 1) + 0.9 * (w - 1) * (w - 1));
}

/// How many coin pickups a wave pays out in total. The opening waves get enough
/// for a first purchase; the deep waves grow with the shelf's prices, so a good
/// gun stays reachable instead of a fantasy.
export function coinBudgetForWave(wave) {
  const w = Math.max(1, wave);
  return Math.round(24 + 9 * w);
}

/// Waves 1-3 only ever drop starter guns; every three waves after that unlocks
/// the next bracket, and the big guns stay late.
export function weaponTierForWave(wave) {
  return Math.min(4, 1 + Math.floor((Math.max(1, wave) - 1) / 3));
}

/// Crates are rare early on: the first waves are about surviving, not shopping.
export function weaponDropFactor(wave) {
  if (wave <= 3) return 0.3;
  if (wave <= 6) return 0.6;
  return 1;
}

/// Picks a weapon the floor may drop right now, weighted towards the older and
/// more common guns so the strong ones stay a treat.
export function weaponDropKey(wave) {
  const tier = weaponTierForWave(wave);
  const pool = [];

  for (const key of Object.keys(WEAPONS)) {
    const tierOf = WEAPON_TIERS[key] || 1;
    if (tierOf > tier) continue;

    const weight = Math.max(1, 6 - (tier - tierOf) * 2);
    for (let i = 0; i < weight; i++) pool.push(key);
  }

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
