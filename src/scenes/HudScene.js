// The overlay HUD: health, XP, the wave clock and a pause control. It reads the
// live run state out of the game scene each frame instead of keeping a copy, so
// there is only ever one source of truth.

import { computeLayout, hudGeometry } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { sharpenText } from '../ui/text.js';
import { haptic } from '../haptics.js';
import { initAudio, startMusic, Sfx } from '../game/audio.js';
import { openStatsPanel } from '../ui/statsPanel.js';

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
    this.statsPanel = null;
    this.build();
  }

  build() {
    const L = this.layout;
    const hud = hudGeometry(L);
    const top = hud.stripTop;
    const stripH = hud.stripH;

    // The health strip, wave label and clock are drawn by the game scene itself
    // (below its sprites). Only the controls and the boss bar live up here.
    const pauseR = Math.max(13, Math.round(17 * L.uiScale));
    const pauseX = 10 + (L.width - 20) - pauseR - 10;
    const pauseY = top + stripH / 2;

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
    const bossBarW = Math.min(L.width - 60, Math.round(320 * L.uiScale));
    const bossBarH = Math.max(10, Math.round(12 * L.uiScale));
    const bossBarX = (L.width - bossBarW) / 2;
    const bossBarY = hud.timerY + hud.timerH + 14;

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
    const panelH = Math.round(330 * scale);

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
      .text(cx, cy - 132 * scale, '已暂停', {
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
      y: cy - 74 * scale,
      width: btnW,
      height: btnH,
      icon: 'play',
      label: '继续',
      depth: 12,
      onPress: () => this.togglePause()
    });
    items.push(...resume.items);
    zones.push(resume.zone);

    const stats = makeButton(this, {
      x: cx,
      y: cy - 18 * scale,
      width: btnW,
      height: btnH,
      icon: 'gauge',
      label: '角色属性',
      accent: 0x39e6cd,
      depth: 12,
      onPress: () => this.openStats()
    });
    items.push(...stats.items);
    zones.push(stats.zone);

    const restart = makeButton(this, {
      x: cx,
      y: cy + 38 * scale,
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
      y: cy + 94 * scale,
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

    // Leaving the pause screen takes the character sheet with it.
    if (!paused && this.statsPanel) {
      this.statsPanel.close();
      this.statsPanel = null;
    }
  }

  /// The character sheet, read live from the paused run.
  openStats() {
    if (this.statsPanel) {
      this.statsPanel.close();
      this.statsPanel = null;
    }
    this.statsPanel = openStatsPanel(this);
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
    if (!run || !run.state) return;

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
