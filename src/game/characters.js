// The playable characters. Each one starts a run with different numbers and a
// portrait of its own; the last two have to be earned.

export const CHARACTERS = [
  {
    key: 'spud',
    name: '土豆',
    tagline: '全能',
    desc: '生命、伤害与射速都不偏科。',
    texture: 'hero',
    color: 0x39e6cd,
    hp: 100,
    damage: 12,
    fireInterval: 460,
    speed: 235,
    unlock: null
  },
  {
    key: 'iron',
    name: '铁皮',
    tagline: '重甲',
    desc: '血量极高，但走得很慢。',
    texture: 'hero-iron',
    color: 0x8e9aa6,
    hp: 170,
    damage: 13,
    fireInterval: 540,
    speed: 198,
    unlock: null
  },
  {
    key: 'spark',
    name: '闪电',
    tagline: '速射',
    desc: '射速惊人，但身板很薄。',
    texture: 'hero-spark',
    color: 0xc86bff,
    hp: 80,
    damage: 10,
    fireInterval: 315,
    speed: 245,
    unlock: null
  },
  {
    key: 'gale',
    name: '疾风',
    tagline: '疾行',
    desc: '跑得比怪物快得多，适合绕圈风筝。',
    texture: 'hero-gale',
    color: 0x8ef0b0,
    hp: 95,
    damage: 12,
    fireInterval: 430,
    speed: 310,
    unlock: { type: 'wave', value: 8, text: '活到第 8 波解锁' }
  },
  {
    key: 'ember',
    name: '炮手',
    tagline: '重火力',
    desc: '子弹很重，射速偏慢。',
    texture: 'hero-ember',
    color: 0xf0a05a,
    hp: 120,
    damage: 20,
    fireInterval: 640,
    speed: 215,
    unlock: { type: 'kills', value: 250, text: '累计击杀 250 解锁' }
  }
];

export const DEFAULT_CHARACTER = 'spud';

/// Always returns a character, falling back to the first one if the saved key
/// no longer exists.
export function getCharacter(key) {
  for (const character of CHARACTERS) {
    if (character.key === key) return character;
  }
  return CHARACTERS[0];
}
