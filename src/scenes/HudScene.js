// The overlay HUD: health, XP, the wave clock and a pause control. It reads the
// live run state out of the game scene each frame instead of keeping a copy, so
// there is only ever one source of truth.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { initAudio, startMusic, Sfx } from '../game/audio.js';
import { waveDuration } from '../game/enemies.js';

export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.layout = computeLayout(
      this.scale.gameSize.width,
      this.scale.gameSize.height
    );
    this.pauseShown = false;
    this.nextBeat = 0;
    this.build();

    // Battle music lives on the HUD, which keeps running while the run is paused
    // behind a shop or a choice screen.
    initAudio(this);
    startMusic(this, 'battle');

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  onResize(gameSize) {
    this.layout = computeLayout(gameSize.width, gameSize.height);
    this.tweens.killAll();
    this.children.removeAll(true);
    this.pauseShown = false;
    this.build();
  }

  build() {
    const L = this.layout;
    const top = L.topInset;
    const stripX = 10;
    const stripW = L.width - 20;
    const stripH = Math.round(72 * L.uiScale);
    const size = (n) => `${Math.round(n * L.uiScale)}px`;

    // The strip has to sit *behind* everything it frames: the bars, numbers and
    // icons are all created at the default depth, so a panel drawn above them
    // hid the health bar and the timer completely.
    this.panel = this.add.graphics().setDepth(-1);
    this.panel.fillStyle(0x0b1018, 0.95);
    this.panel.fillRoundedRect(stripX, top, stripW, stripH, 12);
    this.panel.lineStyle(2, 0x2bd3c4, 0.5);
    this.panel.strokeRoundedRect(stripX, top, stripW, stripH, 12);

    const pauseR = Math.max(13, Math.round(17 * L.uiScale));
    const pauseX = stripX + stripW - pauseR - 10;
    const pauseY = top + stripH / 2;

    const barX = stripX + 34;
    const barW = Math.max(70, pauseX - pauseR - barX - 96);
    const barH = Math.max(12, Math.round(14 * L.uiScale));
    const hpY = top + stripH * 0.3;
    const xpY = top + stripH * 0.72;
    const xpH = Math.max(4, Math.round(5 * L.uiScale));
    const xpX = stripX + Math.round(62 * L.uiScale);
    const xpW = Math.max(40, barX + barW - xpX);

    this.heart = this.add
      .image(stripX + 19, hpY, 'icon-heart')
      .setDisplaySize(Math.round(18 * L.uiScale), Math.round(18 * L.uiScale))
      .setTint(0xff5a72);

    this.hpBack = this.add
      .rectangle(barX, hpY, barW, barH, 0x1b2634)
      .setOrigin(0, 0.5);
    this.hpFill = this.add
      .rectangle(barX, hpY, barW, barH, 0xff5a72)
      .setOrigin(0, 0.5);

    this.hpText = this.add
      .text(barX + barW - 8, hpY, '100/100', {
        fontFamily: FONT,
        fontSize: size(13),
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5);

    this.lvText = this.add
      .text(stripX + 12, xpY, 'Lv 1', {
        fontFamily: FONT,
        fontSize: size(13),
        color: COLORS.dim
      })
      .setOrigin(0, 0.5);

    this.xpBack = this.add
      .rectangle(xpX, xpY, xpW, xpH, 0x1d2a3a)
      .setOrigin(0, 0.5);
    this.xpFill = this.add
      .rectangle(xpX, xpY, xpW, xpH, 0x39e6cd)
      .setOrigin(0, 0.5);

    const waveRight = pauseX - pauseR - 10;
    this.waveText = this.add
      .text(waveRight, top + stripH * 0.5, '第 1 波', {
        fontFamily: FONT,
        fontSize: size(17),
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5);

    // The wave clock, big and centred just under the strip, where the eye
    // lands: the number is the run's whole rhythm, so it gets the space.
    const timerW = Math.round(140 * L.uiScale);
    const timerH = Math.round(40 * L.uiScale);
    const timerX = L.width / 2 - timerW / 2;
    const timerY = top + stripH + 6;

    this.timerGfx = this.add.graphics().setDepth(1);
    this.timerGfx.fillStyle(0x0b1018, 0.9);
    this.timerGfx.fillRoundedRect(timerX, timerY, timerW, timerH, 12);
    this.timerGfx.lineStyle(2, 0x2bd3c4, 0.45);
    this.timerGfx.strokeRoundedRect(timerX, timerY, timerW, timerH, 12);

    this.timerText = this.add
      .text(L.width / 2, timerY + timerH * 0.42, '20s', {
        fontFamily: FONT,
        fontSize: `${Math.round(24 * L.uiScale)}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    const timerBarW = timerW - 24;
    const timerBarH = Math.max(3, Math.round(4 * L.uiScale));

    this.timerBack = this.add
      .rectangle(timerX + 12, timerY + timerH - 9, timerBarW, timerBarH, 0x1d2a3a)
      .setOrigin(0, 0.5)
      .setDepth(2);

    this.timerFill = this.add
      .rectangle(timerX + 12, timerY + timerH - 9, timerBarW, timerBarH, 0x2bd3c4)
      .setOrigin(0, 0.5)
      .setDepth(2);

    // Purse, tucked into the gap at the right of the XP row.
    const purseX = barX + barW + 8;
    this.add
      .image(purseX + 7 * L.uiScale, xpY, 'coin')
      .setDisplaySize(Math.round(13 * L.uiScale), Math.round(13 * L.uiScale))
      .setDepth(2);
    this.coinText = this.add
      .text(purseX + 18 * L.uiScale, xpY, '0', {
        fontFamily: FONT,
        fontSize: size(12),
        color: COLORS.goldHex,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(2);

    makeButton(this, {
      x: pauseX,
      y: pauseY,
      width: pauseR * 2,
      height: pauseR * 2,
      icon: 'pause',
      accent: 0x2bd3c4,
      depth: 3,
      onPress: () => this.togglePause()
    });

    // The boss bar sits just under the strip, at the top of the level. It is
    // hidden until a boss wave is actually underway.
    // The boss bar sits just under the strip, at the top of the level. It is
    // hidden until a boss wave is actually underway.
    const bossBarW = Math.min(stripW - 40, Math.round(320 * L.uiScale));
    const bossBarH = Math.max(10, Math.round(12 * L.uiScale));
    const bossBarX = (L.width - bossBarW) / 2;
    const bossBarY = top + stripH + 76;

    this.bossLabel = this.add
      .text(L.width / 2, bossBarY - 13 * L.uiScale, '首领', {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * L.uiScale)}px`,
        color: '#ff9db0',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.bossBack = this.add
      .rectangle(bossBarX, bossBarY, bossBarW, bossBarH, 0x1b2634)
      .setOrigin(0, 0.5)
      .setDepth(2);

    this.bossFill = this.add
      .rectangle(bossBarX, bossBarY, bossBarW, bossBarH, 0xff3d8b)
      .setOrigin(0, 0.5)
      .setDepth(2);

    this.bossItems = [this.bossLabel, this.bossBack, this.bossFill];
    for (const item of this.bossItems) item.setVisible(false);
    this.bossShown = false;

    this.buildDangerLayer();
    this.buildPauseLayer();
    sharpenText(this);
  }

  /// A red rim that throbs once the player is nearly dead, so a low health bar
  /// is felt as well as read.
  buildDangerLayer() {
    const L = this.layout;
    const g = this.add.graphics().setDepth(6).setAlpha(0);

    for (let i = 0; i < 5; i++) {
      const inset = i * Math.max(4, Math.round(6 * L.uiScale));
      g.lineStyle(7, 0xff2b45, 0.2 - i * 0.032);
      g.strokeRect(inset, inset, L.width - inset * 2, L.height - inset * 2);
    }

    this.dangerGfx = g;
    this.dangerShown = false;
  }

  /// The centred wave clock: the seconds left, a bar for how much of the wave is
  /// gone, and a red pulse in the last five seconds.
  updateTimer(run, s) {
    if (!this.timerText) return;

    const boss = !!run.bossFight;
    const clearing = !!run.waveEnding;
    const left = Math.max(0, s.waveLeft);
    const total = waveDuration(s.wave);
    const ratio = total > 0 ? Math.min(1, left / total) : 0;

    if (boss) this.timerText.setText('首领');
    else if (clearing) this.timerText.setText('清场');
    else this.timerText.setText(`${Math.ceil(left)}s`);

    const urgent = !boss && !clearing && left <= 5;

    this.timerText.setColor(
      urgent ? COLORS.dangerHex : boss ? '#ff9db0' : '#ffffff'
    );
    this.timerText.setScale(urgent ? 1 + 0.07 * Math.sin(this.time.now / 90) : 1);

    this.timerBack.setVisible(!boss);
    this.timerFill.setVisible(!boss);
    this.timerFill.setScale(Math.max(0.0001, ratio), 1);
  }

  updateDanger(run) {
    if (!this.dangerGfx) return;

    const s = run.state;
    const ratio = s.maxHp > 0 ? s.hp / s.maxHp : 1;
    const low = !!run.running && ratio < 0.2;

    if (!low) {
      if (this.dangerShown) {
        this.dangerShown = false;
        this.dangerGfx.setAlpha(0);
      }
      return;
    }

    this.dangerShown = true;

    // The closer to zero, the harder the rim pulses.
    const depth = 1 - Math.max(0, ratio) / 0.2;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 150);
    this.dangerGfx.setAlpha(0.3 + 0.55 * pulse * (0.45 + 0.55 * depth));

    if (this.time.now > this.nextBeat) {
      this.nextBeat = this.time.now + 900;
      Sfx.heartbeat();
    }
  }

  buildPauseLayer() {
    const L = this.layout;
    const cx = L.width / 2;
    const cy = L.height / 2;
    const scale = L.uiScale;
    const panelW = Math.min(L.width - 48, 300 * scale);
    const panelH = Math.round(258 * scale);

    const items = [];
    const zones = [];

    const dim = this.add
      .rectangle(cx, cy, L.width, L.height, 0x05080d, 0.74)
      .setDepth(10);
    items.push(dim);

    const panel = this.add.graphics().setDepth(11);
    panel.fillStyle(0x0d1522, 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 18);
    panel.lineStyle(2, 0x2bd3c4, 0.4);
    panel.strokeRoundedRect(
      cx - panelW / 2,
      cy - panelH / 2,
      panelW,
      panelH,
      18
    );
    items.push(panel);

    const title = this.add
      .text(cx, cy - 96 * scale, '已暂停', {
        fontFamily: FONT,
        fontSize: `${Math.round(24 * scale)}px`,
        color: COLORS.ink,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(12);
    items.push(title);

    const btnW = panelW - 48;
    const btnH = Math.round(46 * scale);

    const resume = makeButton(this, {
      x: cx,
      y: cy - 30 * scale,
      width: btnW,
      height: btnH,
      icon: 'play',
      label: '继续',
      depth: 12,
      onPress: () => this.togglePause()
    });
    items.push(...resume.items);
    zones.push(resume.zone);

    const restart = makeButton(this, {
      x: cx,
      y: cy + 34 * scale,
      width: btnW,
      height: btnH,
      icon: 'rotate-ccw',
      label: '重新开始',
      accent: COLORS.gold,
      depth: 12,
      onPress: () => this.restartRun()
    });
    items.push(...restart.items);
    zones.push(restart.zone);

    const home = makeButton(this, {
      x: cx,
      y: cy + 98 * scale,
      width: btnW,
      height: btnH,
      icon: 'chevron-left',
      label: '返回标题',
      accent: 0x2bd3c4,
      depth: 12,
      onPress: () => this.goHome()
    });
    items.push(...home.items);
    zones.push(home.zone);

    this.pauseItems = items;
    this.pauseZones = zones;
    this.applyPauseVisibility(false);
  }

  applyPauseVisibility(visible) {
    for (const item of this.pauseItems) item.setVisible(visible);
    for (const zone of this.pauseZones) {
      if (zone.input) zone.input.enabled = visible;
    }
  }

  setPausedFlag(paused) {
    if (this.pauseShown === paused) return;
    this.pauseShown = paused;
    this.applyPauseVisibility(paused);
  }

  togglePause() {
    const run = this.scene.get('Game');
    if (!run || !run.state || !run.running) return;
    haptic('tick');
    if (run.pausedByUser) run.userResume();
    else run.userPause();
  }

  restartRun() {
    const run = this.scene.get('Game');
    if (!run || !run.restartRun) return;
    haptic('tick');
    run.restartRun();
  }

  goHome() {
    const run = this.scene.get('Game');
    if (!run || !run.goToTitle) return;
    haptic('tick');
    run.goToTitle();
  }

  update() {
    const run = this.scene.get('Game');
    if (!run || !run.state || !this.hpFill) return;
    const s = run.state;

    this.hpFill.setScale(
      Math.max(0.0001, Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1)),
      1
    );
    this.hpText.setText(`${Math.ceil(s.hp)}/${s.maxHp}`);
    this.xpFill.setScale(
      Math.max(0.0001, Phaser.Math.Clamp(s.xp / s.xpNext, 0, 1)),
      1
    );
    this.lvText.setText(`Lv ${s.level}`);

    // 生锈的硬币 caps the purse, so the cap is shown next to the count.
    const coins = Math.floor(s.coins || 0);
    this.coinText.setText(
      Number.isFinite(s.coinCap) ? `${coins}/${s.coinCap}` : String(coins)
    );

    this.waveText.setText(`第 ${s.wave} 波`);
    this.updateTimer(run, s);

    this.updateBossBar(run);
    this.updateDanger(run);
    this.setPausedFlag(!!run.pausedByUser);
  }

  updateBossBar(run) {
    const boss = run.boss;
    const show = !!(run.bossFight && boss && boss.active);

    if (this.bossShown !== show) {
      this.bossShown = show;
      for (const item of this.bossItems) item.setVisible(show);
    }

    if (!show) return;

    const hp = boss.getData('hp') || 0;
    const max = boss.getData('maxHp') || 1;
    this.bossFill.setScale(
      Math.max(0.0001, Phaser.Math.Clamp(hp / max, 0, 1)),
      1
    );
  }
}
