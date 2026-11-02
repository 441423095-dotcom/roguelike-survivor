// What the between-wave shop stocks: five trinkets on the top shelf and four
// weapon cards under them, plus a paid refresh. Every card's quality is rolled
// from the wave's curve, so a deep run is offered real upgrades instead of a
// rack of white guns.

import { ITEM_POOL, ITEM_BY_KEY, itemPrice, shopDiscount } from './passives.js';
import { WEAPONS, WEAPON_SLOTS } from './weapons.js';
import {
  rollWeaponRarity,
  qualityForWave,
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

// ------------------------------------------------------------ build weighting
//
// The shelf reads what the player is already building. Owning one piece of an
// archetype makes the rest of that archetype come up more often, and the piece
// that would complete a half-built one comes up more often still — without ever
// removing the other archetypes from the hat, so mixing and switching builds
// stays possible.

const BUILD_BOOST = 2.2;
const PARTNER_BOOST = 3;

// Which piece finishes which build, both ways: owning either half helps the
// other. 宠物项圈 -> 自爆小飞机, 狂战士之血 -> 荆棘刺甲, and so on.
const BUILD_PARTNERS = {
  collar: ['plane'],
  plane: ['collar'],
  bounce: ['giantcore'],
  giantcore: ['bounce'],
  berserk: ['thorncoat'],
  thorncoat: ['berserk'],
  luckycoin: ['treasury'],
  treasury: ['luckycoin']
};

const EMPTY_PROFILE = { tags: {}, partners: [] };

/// What this run is already building, read from the items it owns and the guns
/// it carries. Each tagged piece adds weight to its own archetype; each piece
/// with a partner puts that partner on a short list that gets a bigger push.
export function buildProfile(owned, loadout) {
  const stacks = owned || {};
  const tags = {};
  const partners = [];

  const note = (def) => {
    if (!def) return;

    if (def.build) tags[def.build] = (tags[def.build] || 0) + 1;

    const partner = BUILD_PARTNERS[def.key];
    if (!partner) return;

    for (const key of partner) {
      if (partners.indexOf(key) === -1) partners.push(key);
    }
  };

  for (const key of Object.keys(stacks)) {
    if (!stacks[key]) continue;
    note(ITEM_BY_KEY[key]);
  }

  for (const slot of loadout || []) {
    if (!slot) continue;
    note(WEAPONS[slot.key] || slot.def);
  }

  return { tags, partners };
}

/// How heavily one shelf entry is weighted for this run. Untagged cards, and
/// everything outside the player's own builds, keep the base weight of 1.
function buildWeight(def, profile) {
  if (!def || !profile) return 1;

  let weight = 1;
  if (def.build && profile.tags[def.build]) weight *= BUILD_BOOST;
  if (profile.partners.indexOf(def.key) !== -1) weight *= PARTNER_BOOST;

  return weight;
}

/// A weighted draw from a list of definitions: a heavy entry is likelier, but
/// every entry in the list still has a chance of coming up.
function pickWeighted(list, profile) {
  let total = 0;
  for (const entry of list) total += buildWeight(entry, profile);

  if (total <= 0) return list[list.length - 1];

  let roll = Math.random() * total;
  for (const entry of list) {
    roll -= buildWeight(entry, profile);
    if (roll <= 0) return entry;
  }

  return list[list.length - 1];
}

function rollItems(
  wave,
  stacks,
  count,
  discount,
  quality = wave,
  allowActive = true,
  profile = EMPTY_PROFILE
) {
  let available = ITEM_POOL.filter(
    (def) => (stacks[def.key] || 0) < (def.max || 1)
  );

  // A character that cannot carry actives is never even shown them.
  if (!allowActive) available = available.filter((def) => !def.active);

  if (available.length === 0) return [];

  const chosen = [];
  const used = [];
  let wantActive = allowActive && Math.random() < 0.5;

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

    // Weighted towards whatever the player already carries, but never only that.
    const def = pickWeighted(pool, profile);
    used.push(def.key);
    chosen.push(def);

    wantActive = !wantActive;
  }

  return chosen.map((def) => {
    const have = stacks[def.key] || 0;
    const max = def.max || 1;
    // A build core always arrives at its own quality or better.
    const rarity = rollWeaponRarity(quality, def.minRank || 0);

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
function rollWeapon(
  wave,
  loadout,
  minRank = 0,
  quality = wave,
  profile = EMPTY_PROFILE
) {
  const weapons = loadout || [];
  const hasFreeSlot = weapons.length < WEAPON_SLOTS;

  const pool = Object.keys(WEAPONS).filter((key) => {
    if (weapons.length === 0) return true;
    if (hasFreeSlot) return true;
    return weapons.some((slot) => slot.key === key);
  });

  if (pool.length === 0) return null;

  const def = pickWeighted(
    pool.map((key) => WEAPONS[key]),
    profile
  );
  if (!def) return null;

  const key = def.key;
  const rarity = rollWeaponRarity(quality, Math.max(minRank, def.minRank || 0));
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
export function rollShopItems(wave, owned, loadout, luck = 0, allowActive = true) {
  const stacks = owned || {};
  const discount = shopDiscount(stacks);
  // 幸运 tilts the shelf's quality, but never far enough to unlock a tier the
  // wave has not reached yet.
  const quality = qualityForWave(wave, luck);
  // What the player is already building: this is what tilts the shelf.
  const profile = buildProfile(stacks, loadout);

  const weapons = [];
  for (let i = 0; i < WEAPON_OFFERS; i++) {
    const weapon = rollWeapon(wave, loadout, 0, quality, profile);
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
      const forced = rollWeapon(wave, loadout, floor, quality, profile);
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
    quality,
    allowActive,
    profile
  );

  return items.concat(weapons);
}
