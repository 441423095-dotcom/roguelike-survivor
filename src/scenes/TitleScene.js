// The start screen: the game's name over the arena artwork, one glowing way into
// the fight, and the side doors into the meta screens. The backdrop picture is
// optional — without it the screen falls back to the procedural grid and stars.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { haptic } from '../haptics.js';
import { loadProgress, formatDuration, clearProgress } from '../game/progress.js';
import { loadMeta } from '../game/meta.js';
import { initAudio, startMusic } from '../game/audio.js';
import { sharpenText } from '../ui/text.js';
import { applyCameraZoom, viewSize } from '../ui/view.js';

const GAME_TITLE = '像素弹幕生存';
const STORY_KICKER = '星尘竞技场';
const STORY_TEXT =
  '无尽的怪潮正从数据裂缝中涌出。没有救援，没有终点。' +
  '你唯一的出路，就是用手中的武器和荒诞的道具，杀出一条血路。';
const VERSION_LABEL = 'Version 1.0.0';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  preload() {
    // The arena artwork. If it is missing the scene still works: the grid and
    // stars below are drawn in code and are the whole backdrop on their own.
    this.load.image('title-bg', 'assets/title-bg.png');
  }

  create() {
    applyCameraZoom(this);
    this.cameras.main.setBackgroundColor(0x04060b);
    this.build();

    initAudio(this);
    startMusic(this, 'menu');

    // The game is on screen: dismiss the boot panel in index.html.
    if (window.gameReady) window.gameReady();

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  onResize() {
    this.rebuild();
  }

  rebuild() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.build();
  }

  build() {
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    this.buildBackdrop(W, H);

    const titleY = H * 0.235;
    this.buildTitle(W, H, s, titleY);

    const btnW = Math.min(W - 84, 272 * s);
    const btnH = Math.round(60 * s);
    const btnY = H * 0.575;
    this.buildStart(W, H, s, btnY, btnW, btnH);

    const secY = btnY + btnH / 2 + 30 * s;
    this.buildSecondary(W, H, s, secY);

    // Star dust is spent here, never inside a run.
    makeButton(this, {
      x: W / 2,
      y: secY + Math.round(48 * s),
      width: Math.min(W - 120, 220 * s),
      height: Math.round(34 * s),
      icon: 'sparkles',
      label: `星尘商店 · ${loadMeta().shards}`,
      fontSize: Math.round(12 * s),
      accent: 0xffd166,
      depth: 3,
      onPress: () => this.openMetaShop()
    });

    this.buildRecords(W, H, s, H * 0.845);
    this.buildVersion(W, H, s);

    sharpenText(this);
  }

  // ---------------------------------------------------------------- backdrop

  /// The arena artwork, when it is there, fills the screen behind everything:
  /// cover-fit, with a dark veil over it and the procedural grid, stars and
  /// watermark kept at a whisper so the picture stays the backdrop.
  buildBackdrop(W, H) {
    let strength = 1;

    if (this.textures.exists('title-bg')) {
      const art = this.add.image(W / 2, H / 2, 'title-bg').setDepth(-40);
      art.setScale(Math.max(W / art.width, H / art.height));

      // The veil keeps the wordmark and the story readable over any picture.
      this.add
        .rectangle(W / 2, H / 2, W, H, 0x04060b, 0.52)
        .setDepth(-39);

      strength = 0.4;
    }

    const grid = this.add.graphics().setDepth(-30);
    const step = Math.max(28, Math.round(W / 11));

    grid.lineStyle(1, 0x2a5866, 0.55);
    for (let x = 0; x <= W + step; x += step) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H + step; y += step) grid.lineBetween(0, y, W, y);
    grid.setAlpha(0.22 * strength);
    this.tweens.add({
      targets: grid,
      alpha: 0.1 * strength,
      duration: 7000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    const nebulaA = this.add
      .ellipse(W * 0.18, H * 0.18, W * 0.95, W * 0.95, 0x0d3a44, 0.5 * strength)
      .setDepth(-31);
    this.tweens.add({
      targets: nebulaA,
      alpha: 0.22 * strength,
      scale: 1.08,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    const nebulaB = this.add
      .ellipse(W * 0.86, H * 0.78, W * 0.9, W * 0.9, 0x2a1a45, 0.45 * strength)
      .setDepth(-31);
    this.tweens.add({
      targets: nebulaB,
      alpha: 0.2 * strength,
      scale: 1.06,
      duration: 11000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    const stars = Math.min(70, Math.round((W * H) / 9000));
    for (let i = 0; i < stars; i++) {
      const star = this.add
        .circle(
          Phaser.Math.Between(0, W),
          Phaser.Math.Between(0, H),
          Math.random() < 0.85 ? 1 : 1.8,
          0xa8e6ff,
          Phaser.Math.FloatBetween(0.12, 0.5) * strength
        )
        .setDepth(-29);

      this.tweens.add({
        targets: star,
        y: star.y - Phaser.Math.Between(26, 96),
        alpha: 0.04,
        duration: Phaser.Math.Between(4200, 9000),
        delay: Phaser.Math.Between(0, 3200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }

    // The hero, huge and almost invisible, as a watermark behind everything.
    const size = Math.min(W, H) * 0.94;
    const mark = this.add
      .image(W / 2, H * 0.47, 'hero')
      .setDisplaySize(size, size)
      .setAlpha(0.05 * strength)
      .setTint(0x63ffe0)
      .setDepth(-28);
    this.tweens.add({
      targets: mark,
      scale: mark.scale * 1.03,
      duration: 8000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  // ------------------------------------------------------------------- title

  buildTitle(W, H, s, titleY) {
    const size = Math.round(Math.min(W * 0.135, 54 * s));

    const glow = this.add
      .text(W / 2, titleY, GAME_TITLE, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: '#39e6cd',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setAlpha(0.34)
      .setDepth(1);
    glow.setShadow(0, 0, '#2bd3c4', 22, true, true);

    this.tweens.add({
      targets: glow,
      alpha: 0.16,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    const title = this.add
      .text(W / 2, titleY, GAME_TITLE, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: '#f4feff',
        fontStyle: 'bold',
        stroke: '#08222a',
        strokeThickness: Math.max(4, Math.round(size * 0.08))
      })
      .setOrigin(0.5)
      .setDepth(2);
    title.setShadow(0, Math.round(size * 0.16), '#01040a', 14, false, true);

    // A hairline under the wordmark, like a title plate.
    const lineW = Math.min(W * 0.52, 200 * s);
    const lineY = titleY + size * 0.72;
    const line = this.add.graphics().setDepth(2);
    line.lineStyle(2, 0x2bd3c4, 0.45);
    line.lineBetween(W / 2 - lineW / 2, lineY, W / 2 + lineW / 2, lineY);
    line.lineStyle(1, 0x2bd3c4, 0.18);
    line.lineBetween(
      W / 2 - lineW * 0.3,
      lineY + 5 * s,
      W / 2 + lineW * 0.3,
      lineY + 5 * s
    );

    // The story sits under the wordmark, on a soft scrim so it stays readable
    // whatever is behind it.
    const storyTop = titleY + size * 1.02;
    const storyW = Math.min(W - 56, 330 * s);

    this.add
      .text(W / 2, storyTop, STORY_KICKER, {
        fontFamily: FONT,
        fontSize: `${Math.round(12.5 * s)}px`,
        color: COLORS.accentHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    const story = this.add
      .text(W / 2, storyTop + 20 * s, STORY_TEXT, {
        fontFamily: FONT,
        fontSize: `${Math.round(12.5 * s)}px`,
        color: '#a8c8d2',
        align: 'center',
        wordWrap: { width: storyW, useAdvancedWrap: true },
        lineSpacing: Math.round(5 * s)
      })
      .setOrigin(0.5, 0)
      .setDepth(2);

    this.add
      .rectangle(
        W / 2,
        story.y + story.height / 2,
        storyW + 34 * s,
        story.height + 44 * s,
        0x04080f,
        0.42
      )
      .setDepth(1);
  }

  // ----------------------------------------------------------------- buttons

  buildStart(W, H, s, btnY, btnW, btnH) {
    const glow = this.add.graphics().setDepth(1);
    const gx = W / 2 - btnW / 2 - 10;
    const gy = btnY - btnH / 2 - 10;
    const gw = btnW + 20;
    const gh = btnH + 20;

    glow.fillStyle(0x39e6cd, 0.05);
    glow.fillRoundedRect(gx, gy, gw, gh, 22);
    glow.lineStyle(12, 0x39e6cd, 0.08);
    glow.strokeRoundedRect(gx, gy, gw, gh, 22);
    glow.lineStyle(2, 0x39e6cd, 0.6);
    glow.strokeRoundedRect(gx, gy, gw, gh, 22);

    // The breathing light: the border brightens and dims on its own.
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.45, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    makeButton(this, {
      x: W / 2,
      y: btnY,
      width: btnW,
      height: btnH,
      icon: 'play',
      label: '开始游戏',
      fontSize: Math.round(19 * s),
      accent: 0x2bd3c4,
      depth: 3,
      onPress: () => this.startRun()
    });
  }

  buildSecondary(W, H, s, y) {
    const gap = 12 * s;
    const width = Math.min((W - 60 - gap) / 2, 152 * s);
    const height = Math.round(42 * s);

    makeButton(this, {
      x: W / 2 - width / 2 - gap / 2,
      y,
      width,
      height,
      icon: 'book-open',
      label: '玩法说明',
      fontSize: Math.round(12 * s),
      accent: 0x8fd8ff,
      depth: 3,
      onPress: () => this.openHowTo()
    });

    makeButton(this, {
      x: W / 2 + width / 2 + gap / 2,
      y,
      width,
      height,
      icon: 'medal',
      label: '图鉴 / 成就',
      fontSize: Math.round(12 * s),
      accent: 0xffd166,
      depth: 3,
      onPress: () => this.openCompendium()
    });
  }

  // ------------------------------------------------------------------ sheets

  /// One dark sheet for the small screens that ride on top of the title.
  buildSheet(title, lines, actions) {
    const W = viewSize(this).width;
    const H = viewSize(this).height;
    const s = computeLayout(W, H).uiScale;

    const dim = this.add
      .rectangle(W / 2, H / 2, W, H, 0x03060a, 0.84)
      .setDepth(10)
      .setInteractive();
    dim.on('pointerdown', () => this.rebuild());

    const panelW = Math.min(W - 40, 340 * s);
    const bodyH = Math.max(1, lines.length) * Math.round(24 * s);
    const panelH = Math.round(112 * s + bodyH + 56 * s);
    const left = W / 2 - panelW / 2;
    const top = H / 2 - panelH / 2;

    const panel = this.add.graphics().setDepth(11);
    panel.fillStyle(0x0b1018, 0.99);
    panel.fillRoundedRect(left, top, panelW, panelH, 16);
    panel.lineStyle(2, 0x2bd3c4, 0.45);
    panel.strokeRoundedRect(left, top, panelW, panelH, 16);

    // Taps on the sheet itself do nothing; only its edge closes it, so the
    // buttons underneath always keep their own taps.
    this.add
      .zone(W / 2, H / 2, panelW, panelH)
      .setDepth(11)
      .setInteractive()
      .on('pointerdown', () => {});

    this.add
      .text(W / 2, top + 26 * s, title, {
        fontFamily: FONT,
        fontSize: `${Math.round(17 * s)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(12);

    lines.forEach((line, index) => {
      this.add
        .text(left + 20 * s, top + 54 * s + index * Math.round(24 * s), line, {
          fontFamily: FONT,
          fontSize: `${Math.round(12 * s)}px`,
          color: '#d6e3ee',
          wordWrap: { width: panelW - 40 * s, useAdvancedWrap: true },
          lineSpacing: Math.round(2 * s)
        })
        .setOrigin(0, 0)
        .setDepth(12);
    });

    const buttons =
      actions && actions.length > 0
        ? actions
        : [{ label: '知道了', accent: 0x2bd3c4, onPress: () => this.rebuild() }];

    const sideGap = 10 * s;
    const buttonW = (panelW - sideGap * (buttons.length + 1)) / buttons.length;
    buttons.forEach((action, index) => {
      makeButton(this, {
        x: left + sideGap * (index + 1) + buttonW * (index + 0.5),
        y: top + panelH - 32 * s,
        width: buttonW,
        height: Math.round(38 * s),
        label: action.label,
        fontSize: Math.round(13 * s),
        accent: action.accent,
        depth: 12,
        onPress: action.onPress
      });
    });

    sharpenText(this);
  }

  openHowTo() {
    haptic('tick');
    this.buildSheet('玩法说明', [
      '滑动屏幕任意处走位，松手就停，不用找摇杆。',
      '武器会自动开火；右下角闪电是闪现，闪现期间无敌。',
      '每波结束进补给站，用金币买奇葩道具和更强的武器。',
      '同名同品质的武器可以免费合成升阶，最多带 5 把。',
      '第 5、10、15… 波会来首领，撑住就继续下一波。'
    ]);
  }

  openCompendium() {
    haptic('tick');
    this.buildSheet('图鉴 / 成就', [], [
      {
        label: '怪物图鉴',
        accent: 0x39e6cd,
        onPress: () => this.scene.start('Bestiary')
      },
      {
        label: '成就档案',
        accent: 0xffd166,
        onPress: () => this.scene.start('Achievement')
      },
      { label: '关闭', accent: 0x8fa3b0, onPress: () => this.rebuild() }
    ]);
  }

  // ---------------------------------------------------------------- records

  /// The archive strip above the footer, plus the (deliberately tucked away)
  /// way to wipe it.
  buildRecords(W, H, s, y) {
    const progress = loadProgress();
    const panelW = Math.min(W - 44, 340 * s);
    const panelH = Math.round(50 * s);
    const panelX = (W - panelW) / 2;
    const panelY = y - panelH / 2;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0b1018, 0.7);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    g.lineStyle(1, 0x2bd3c4, 0.22);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

    const entries = [
      ['最高波次', `第 ${progress.bestWave} 波`, progress.bestWave > 0],
      ['最多击杀', `${progress.bestKills}`, progress.bestKills > 0],
      ['最长存活', formatDuration(progress.bestTime), progress.bestTime > 0]
    ];

    entries.forEach((entry, index) => {
      const cx = panelX + (panelW / 3) * (index + 0.5);

      this.add
        .text(cx, y - 8 * s, entry[0], {
          fontFamily: FONT,
          fontSize: `${Math.round(9.5 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0.5)
        .setDepth(3);

      this.add
        .text(cx, y + 9 * s, entry[1], {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: entry[2] ? COLORS.goldHex : COLORS.ink,
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setDepth(3);
    });

    this.clearArmed = false;
    this.clearText = this.add
      .text(W - 14 * s, H - 12 * s, '清空记录', {
        fontFamily: FONT,
        fontSize: `${Math.round(10 * s)}px`,
        color: COLORS.dim
      })
      .setOrigin(1, 1)
      .setDepth(3)
      .setInteractive();

    this.clearText.on('pointerdown', () => this.tapClear());
  }

  buildVersion(W, H, s) {
    this.add
      .text(14 * s, H - 12 * s, VERSION_LABEL, {
        fontFamily: FONT,
        fontSize: `${Math.round(10 * s)}px`,
        color: '#5f7d89'
      })
      .setOrigin(0, 1)
      .setDepth(3);
  }

  // ------------------------------------------------------------- navigation

  startRun() {
    haptic('tick');
    this.scene.start('Difficulty');
  }

  openMetaShop() {
    haptic('tick');
    this.scene.start('MetaShop');
  }

  /// Wiping is destructive, so the first tap only arms it.
  tapClear() {
    if (!this.clearArmed) {
      this.clearArmed = true;
      this.clearText.setText('再点一次确认清空');
      this.clearText.setColor(COLORS.dangerHex);

      this.time.delayedCall(3200, () => {
        if (!this.clearArmed) return;
        this.clearArmed = false;
        if (this.clearText && this.clearText.active) {
          this.clearText.setText('清空记录');
          this.clearText.setColor(COLORS.dim);
        }
      });
      return;
    }

    this.clearArmed = false;
    clearProgress();
    haptic('impact');
    this.rebuild();
  }
}
