// The screen you pass on the way into a run: every character, its starting
// numbers, and what is still locked (and how to unlock it). The pick is saved
// immediately, so it is still selected the next time the game opens.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { sharpenText } from '../ui/text.js';
import { applyCameraZoom, viewSize } from '../ui/view.js';
import { haptic } from '../haptics.js';
import { CHARACTERS, getCharacter } from '../game/characters.js';
import { loadProgress, isUnlocked, selectCharacter } from '../game/progress.js';
import { metaCharacterUnlocked } from '../game/meta.js';
import { startMusic } from '../game/audio.js';

/// A numeric colour as a CSS string, for text.
function hexOf(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/// A near-black version of a colour, for the portrait tile behind a sprite.
function shade(color, factor) {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character');
  }

  create() {
    applyCameraZoom(this);
    startMusic(this, 'menu');
    const progress = loadProgress();
    const saved = getCharacter(progress.character);
    if (!isUnlocked(progress, saved) && !metaCharacterUnlocked(saved.key)) {
      progress.character = 'spud';
    }

    this.progress = progress;
    this.refs = [];

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

  build() {
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 0.9).setDepth(1);

    const titleY = Math.max(40 * s, H * 0.07);

    this.add
      .text(W / 2, titleY, '选择角色', {
        fontFamily: FONT,
        fontSize: `${Math.round(23 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(W / 2, titleY + 24 * s, '五位角色，五套专属技能，选好再出发', {
        fontFamily: FONT,
        fontSize: `${Math.round(11.5 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(0.5)
      .setDepth(2);

    makeButton(this, {
      x: 34 * s + 12,
      y: titleY,
      width: Math.round(46 * s),
      height: Math.round(36 * s),
      icon: 'chevron-left',
      accent: 0x2bd3c4,
      depth: 2,
      onPress: () => this.back()
    });

    const gap = Math.round(8 * s);
    const top = titleY + 46 * s;
    const bottom = H - 92 * s;
    const count = CHARACTERS.length;
    const avail = Math.max(200, bottom - top);
    // Tall enough for four lines: name, numbers, the highlighted skill, a note.
    const cardH = Math.max(
      92,
      Math.min(122 * s, (avail - gap * (count - 1)) / count)
    );
    const groupH = cardH * count + gap * (count - 1);
    const startY = top + Math.max(0, (avail - groupH) / 2);
    const cardW = Math.min(W - 32, 430 * s);

    CHARACTERS.forEach((character, index) => {
      const cy = startY + index * (cardH + gap) + cardH / 2;
      this.buildCard(character, W / 2, cy, cardW, cardH, s);
    });

    makeButton(this, {
      x: W / 2,
      y: H - 54 * s,
      width: Math.min(W - 60, 240 * s),
      height: Math.round(48 * s),
      icon: 'play',
      label: '出发',
      fontSize: Math.round(17 * s),
      depth: 3,
      onPress: () => this.startRun()
    });

    sharpenText(this);
  }

  buildCard(character, cx, cy, w, h, s) {
    const g = this.add.graphics().setDepth(2);

    // The portrait sits on a tile in the character's own colour, with a small
    // faction badge on it, so the five cards are told apart at a glance.
    const tileSize = Math.min(h - 14 * s, 60 * s);
    const tileX = cx - w / 2 + 10 * s;
    const tileY = cy - tileSize / 2;

    const portrait = this.add
      .image(tileX + tileSize / 2, cy, character.texture)
      .setDisplaySize(tileSize - 10 * s, tileSize - 10 * s)
      .setDepth(3);

    const badge = this.add
      .image(
        tileX + tileSize - 3 * s,
        tileY + tileSize - 3 * s,
        `icon-${character.icon}`
      )
      .setDisplaySize(14 * s, 14 * s)
      .setTint(character.color)
      .setDepth(4);

    const textX = tileX + tileSize + 12 * s;
    // Leave the right edge free for the lock icon and the "已选" tag.
    const textW = Math.max(80, cx + w / 2 - 40 * s - textX);
    const top = cy - h / 2;

    const name = this.add
      .text(textX, top + Math.max(16 * s, h * 0.16), character.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    const tagline = this.add
      .text(name.x + name.width + 8 * s, name.y, character.tagline, {
        fontFamily: FONT,
        fontSize: `${Math.round(10.5 * s)}px`,
        color: hexOf(character.color),
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    const stats = this.add
      .text(textX, top + h * 0.4, this.statLine(character), {
        fontFamily: FONT,
        fontSize: `${Math.round(10.5 * s)}px`,
        color: COLORS.dim,
        wordWrap: { width: textW }
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    // The exclusive skill, the reason to pick this character: a cyan tag with
    // the name and rule in gold underneath it.
    const skillY = top + h * 0.54;
    const skillLabel = this.add
      .text(textX, skillY, '专属', {
        fontFamily: FONT,
        fontSize: `${Math.round(10 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0)
      .setDepth(3);

    const skillText = this.add
      .text(
        textX + skillLabel.width + 6 * s,
        skillY - 1 * s,
        `${character.skill.name}：${character.skill.text}`,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(10.5 * s)}px`,
          color: '#ffe27a',
          fontStyle: 'bold',
          wordWrap: { width: textW - skillLabel.width - 6 * s },
          lineSpacing: Math.round(1 * s)
        }
      )
      .setOrigin(0, 0)
      .setDepth(3);
    if (typeof skillText.setMaxLines === 'function') skillText.setMaxLines(2);

    const note = this.add
      .text(
        textX,
        top + h * 0.86,
        character.unlock ? character.unlock.text : character.desc,
        {
          fontFamily: FONT,
          fontSize: `${Math.round(10.5 * s)}px`,
          color: COLORS.goldHex,
          wordWrap: { width: textW }
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(3);

    const lockIcon = this.add
      .image(cx + w / 2 - 20 * s, cy, 'icon-lock')
      .setDisplaySize(16 * s, 16 * s)
      .setTint(0x8fa3b0)
      .setDepth(3);

    const chosen = this.add
      .text(cx + w / 2 - 14 * s, top + Math.max(16 * s, h * 0.16), '已选', {
        fontFamily: FONT,
        fontSize: `${Math.round(12 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(3);

    const paint = () => {
      const unlocked = this.characterUnlocked(character);
      const selected =
        this.progress.character === character.key && unlocked;

      g.clear();
      g.fillStyle(selected ? 0x14303a : unlocked ? 0x0f1521 : 0x0a0e14, 0.97);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
      g.lineStyle(
        2,
        selected ? COLORS.accent : unlocked ? 0x2bd3c4 : 0x2a3440,
        selected ? 1 : unlocked ? 0.35 : 0.5
      );
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);

      // The portrait tile, tinted by the character itself.
      g.fillStyle(shade(character.color, selected ? 0.34 : unlocked ? 0.22 : 0.1), 1);
      g.fillRoundedRect(tileX, tileY, tileSize, tileSize, 10 * s);
      g.lineStyle(
        1.5,
        character.color,
        selected ? 0.95 : unlocked ? 0.45 : 0.16
      );
      g.strokeRoundedRect(tileX, tileY, tileSize, tileSize, 10 * s);

      portrait.setTint(unlocked ? 0xffffff : 0x4a4a4a);
      portrait.setAlpha(unlocked ? 1 : 0.6);
      badge.setAlpha(unlocked ? 1 : 0.35);
      name.setColor(unlocked ? COLORS.ink : COLORS.dim);
      tagline.setColor(unlocked ? hexOf(character.color) : '#5c6a76');
      stats.setColor(unlocked ? COLORS.dim : '#5c6a76');
      skillLabel.setColor(unlocked ? COLORS.accentHex : '#4f6a70');
      skillText.setColor(unlocked ? '#ffe27a' : '#8a7a44');
      note.setColor(unlocked ? COLORS.dim : COLORS.goldHex);
      lockIcon.setVisible(!unlocked);
      chosen.setVisible(selected);
    };

    paint();

    const zone = this.add.zone(cx, cy, w, h).setInteractive();
    zone.on('pointerdown', () => this.pick(character.key));

    this.refs.push({ paint });
  }

  /// A character counts as unlocked if the run condition was met or star dust
  /// bought them in the meta shop.
  characterUnlocked(character) {
    return isUnlocked(this.progress, character) || metaCharacterUnlocked(character.key);
  }

  statLine(character) {
    return (
      `生命 ${character.hp} · 攻击 ${character.damage} · ` +
      `攻速 ${(1000 / character.fireInterval).toFixed(1)} · 移速 ${character.speed}`
    );
  }

  pick(key) {
    const character = getCharacter(key);

    if (!this.characterUnlocked(character)) {
      haptic('tick');
      return;
    }

    this.progress = selectCharacter(key);
    haptic('tick');
    for (const ref of this.refs) ref.paint();
  }

  startRun() {
    haptic('tick');
    this.scene.start('Game');
  }

  back() {
    haptic('tick');
    this.scene.start('Title');
  }
}
