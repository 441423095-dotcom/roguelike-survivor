// The playable characters. Each one starts a run with different numbers, its own
// look and one exclusive skill that decides how it is played; the last two have
// to be earned.
//
// The keys are the save-file identity, so they never change even though the
// names on screen do.

export const CHARACTERS = [
  {
    key: 'spud',
    name: '小明',
    tagline: '均衡者',
    desc: '什么流派都玩得转的起点角色。',
    texture: 'hero',
    icon: 'sparkles',
    color: 0x39e6cd,
    hp: 100,
    damage: 12,
    fireInterval: 460,
    speed: 235,
    unlock: null,
    skill: {
      key: 'adapt',
      name: '随遇而安',
      text: '每过 3 波，随机获得一项永久属性提升',
      icon: 'sparkles',
      color: 0x9ce6ff
    }
  },
  {
    key: 'iron',
    name: '铁憨憨',
    tagline: '重装坦克',
    desc: '血量极高、走得很慢；只能带被动道具。',
    texture: 'hero-iron',
    icon: 'shield',
    color: 0x8e9aa6,
    hp: 170,
    damage: 13,
    fireInterval: 540,
    speed: 198,
    noActive: true,
    unlock: null,
    skill: {
      key: 'thorns',
      name: '反伤重甲',
      text: '受伤时对周围敌人造成最大生命 6% 的伤害',
      icon: 'shield',
      color: 0xffd166
    }
  },
  {
    key: 'spark',
    name: '幻影',
    tagline: '脆皮刺客',
    desc: '暴击极高，但身板薄、受伤翻倍。',
    texture: 'hero-spark',
    icon: 'target',
    color: 0xc86bff,
    hp: 80,
    damage: 10,
    fireInterval: 315,
    speed: 245,
    unlock: null,
    skill: {
      key: 'phase',
      name: '极限闪避',
      text: '移动时 10% 概率闪过子弹；暴击 +30%，受伤 ×2',
      icon: 'target',
      color: 0x8ef0ff
    }
  },
  {
    key: 'gale',
    name: '风行者',
    tagline: '跑酷达人',
    desc: '跑得比怪物快得多，靠走位风筝一切。',
    texture: 'hero-gale',
    icon: 'footprints',
    color: 0x8ef0b0,
    hp: 95,
    damage: 12,
    fireInterval: 430,
    speed: 310,
    unlock: { type: 'wave', value: 8, text: '活到第 8 波解锁' },
    skill: {
      key: 'kinetic',
      name: '动能转化',
      text: '每移动 100 距离，下一击必定暴击；站着不动伤害逐渐降低',
      icon: 'footprints',
      color: 0xffe27a
    }
  },
  {
    key: 'ember',
    name: '爆破狂',
    tagline: '重火力狂',
    desc: '子弹很重、射速偏慢，一发就能清一片。',
    texture: 'hero-ember',
    icon: 'flame',
    color: 0xf0a05a,
    hp: 120,
    damage: 20,
    fireInterval: 640,
    speed: 215,
    unlock: { type: 'kills', value: 250, text: '累计击杀 250 解锁' },
    skill: {
      key: 'barrage',
      name: '火力覆盖',
      text: '射程 +30%，所有武器附带溅射；射速 -17%',
      icon: 'flame',
      color: 0xff9a3f
    }
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
