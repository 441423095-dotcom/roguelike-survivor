// Run summary and the way back in.

import { computeLayout } from '../ui/layout.js';
import { COLORS, FONT } from '../ui/style.js';
import { makeButton } from '../ui/widgets.js';
import { sharpenText } from '../ui/text.js';
import { formatDuration } from '../game/progress.js';
import { ENDLESS_FROM, isEndlessWave } from '../game/enemies.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.summary = data || { wave: 1, kills: 0, time: 0 };
    this.records =
      (data && data.records) || { wave: false, kills: false, time: false };
    this.best = (data && data.best) || null;
  }

  create() {
    this.build();

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  onResize() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.build();
  }

  build() {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const L = computeLayout(W, H);
    const s = L.uiScale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d, 0.86).setDepth(1);

    const panelW = Math.min(W - 48, 320 * s);
    const panelH = Math.round(360 * s);
    const cx = W / 2;
    const cy = H / 2;

    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(0x0d1522, 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 20);
    panel.lineStyle(2, 0xff5a72, 0.45);
    panel.strokeRoundedRect(
      cx - panelW / 2,
      cy - panelH / 2,
      panelW,
      panelH,
      20
    );

    this.add
      .text(cx, cy - panelH / 2 + 42 * s, '你倒下了', {
        fontFamily: FONT,
        fontSize: `${Math.round(26 * s)}px`,
        color: COLORS.dangerHex,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(3);

    // A broken record is called out right under the title.
    const recordNames = [];
    if (this.records.wave) recordNames.push('最高波次');
    if (this.records.kills) recordNames.push('最多击杀');
    if (this.records.time) recordNames.push('最长存活');

    if (recordNames.length > 0) {
      this.add
        .text(
          cx,
          cy - panelH / 2 + 74 * s,
          `新纪录：${recordNames.join('、')}`,
          {
            fontFamily: FONT,
            fontSize: `${Math.round(12 * s)}px`,
            color: COLORS.goldHex,
            fontStyle: 'bold'
          }
        )
        .setOrigin(0.5)
        .setDepth(3);
    }

    const wave = this.summary.wave || 1;
    const endless = isEndlessWave(wave);

    const rows = [
      [
        '到达波次',
        endless ? `无尽波 ${wave}` : `第 ${wave} 波`,
        !!this.records.wave
      ],
      ['击杀数量', `${this.summary.kills || 0}`, !!this.records.kills],
      ['存活时间', formatDuration(this.summary.time), !!this.records.time]
    ];

    rows.forEach((row, index) => {
      const y = cy - panelH / 2 + (100 + index * 26) * s;
      this.add
        .text(cx - panelW / 2 + 26 * s, y, row[0], {
          fontFamily: FONT,
          fontSize: `${Math.round(13 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0, 0.5)
        .setDepth(3);
      this.add
        .text(cx + panelW / 2 - 26 * s, y, row[1], {
          fontFamily: FONT,
          fontSize: `${Math.round(14 * s)}px`,
          color: row[2] ? COLORS.goldHex : COLORS.ink,
          fontStyle: 'bold'
        })
        .setOrigin(1, 0.5)
        .setDepth(3);
    });

    if (this.best) {
      this.add
        .text(
          cx,
          cy - panelH / 2 + 180 * s,
          `历史最佳：第 ${this.best.bestWave} 波 · ${this.best.bestKills} 击杀 · ${formatDuration(
            this.best.bestTime
          )}`,
          {
            fontFamily: FONT,
            fontSize: `${Math.round(12 * s)}px`,
            color: COLORS.dim
          }
        )
        .setOrigin(0.5)
        .setDepth(3);
    }

    // Endless runs get their own line: the wave count only means something if
    // the summary says how far past the normal run it went.
    if (endless) {
      this.add
        .text(
          cx,
          cy - panelH / 2 + 204 * s,
          `进入无尽模式后撑过 ${wave - ENDLESS_FROM} 波`,
          {
            fontFamily: FONT,
            fontSize: `${Math.round(12 * s)}px`,
            color: COLORS.goldHex,
            fontStyle: 'bold'
          }
        )
        .setOrigin(0.5)
        .setDepth(3);
    }

    const btnW = panelW - 48;
    const btnH = Math.round(46 * s);

    makeButton(this, {
      x: cx,
      y: cy + panelH / 2 - 108 * s,
      width: btnW,
      height: btnH,
      icon: 'rotate-ccw',
      label: '再来一局',
      fontSize: Math.round(16 * s),
      depth: 3,
      onPress: () => this.restart()
    });

    makeButton(this, {
      x: cx,
      y: cy + panelH / 2 - 52 * s,
      width: btnW,
      height: btnH,
      icon: 'chevron-left',
      label: '返回标题',
      fontSize: Math.round(16 * s),
      accent: 0x2bd3c4,
      depth: 3,
      onPress: () => this.goHome()
    });

    sharpenText(this);
  }

  restart() {
    const run = this.scene.get('Game');
    if (run && run.restartRun) run.restartRun();
  }

  goHome() {
    const run = this.scene.get('Game');
    if (run && run.goToTitle) run.goToTitle();
    else this.scene.start('Title');
  }
}
