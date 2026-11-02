// The two difficulty tiers. The multipliers here are the whole rule set: the
// run applies them to enemy health and damage and to the coin value of a drop.

export const DIFFICULTIES = [
  {
    key: 'normal',
    name: '普通',
    icon: 'shield',
    color: 0x39e6cd,
    hex: '#39e6cd',
    desc: '按原本的节奏推进，适合熟悉机制和练走位。',
    hp: 1,
    damage: 1,
    coin: 1
  },
  {
    key: 'hard',
    name: '困难',
    icon: 'flame',
    color: 0xff7a1f,
    hex: '#ff7a1f',
    desc: '怪物更硬也更痛，但掉落的金币同样更多。',
    hp: 1.3,
    damage: 1.2,
    coin: 1.2
  }
];

export const DEFAULT_DIFFICULTY = 'normal';

export function difficultyFor(key) {
  for (const def of DIFFICULTIES) {
    if (def.key === key) return def;
  }
  return DIFFICULTIES[0];
}
