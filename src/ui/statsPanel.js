// The character sheet: every number the run has stacked, in one frosted cyber
// panel. It can be opened from the shop or from the pause menu, reads the live
// state straight out of the game scene, and closes with the X in the corner.
//
// Base values print as numbers ("移速 235"); bonuses print as percentages
// ("攻速 +24%"), which is how a player knows what a level actually bought them.

import { computeLayout } from './layout.js';
import { COLORS, FONT } from './style.js';
import { makeButton } from './widgets.js';
import { sharpenText } from './text.js';
import { viewSize } from './view.js';
import { haptic } from '../haptics.js';

/// A percentage change of `value` against `from`, or an em dash when the run has
/// no baseline to compare with.
function change(value, from) {
  if (!from || !Number.isFinite(from) || !Number.isFinite(value)) return '—';
  const delta = Math.round((value / from - 1) * 100);
  return delta > 0 ? `+${delta}%` : `${delta}%`;
}

function statGroups(run) {
  const s = run.state;
  const base = run.baseStats || {};

  return [
    {
      title: '基础',
      rows: [
        { label: '生命值', value: `${Math.ceil(s.hp)} / ${Math.round(s.maxHp)}` },
        { label: '护甲', value: `-${Math.round((s.armor || 0) * 100)}%`, hot: true },
        { label: '移动速度', value: String(Math.round(s.speed)) },
        { label: '闪避率', value: `+${Math.round((s.dodge || 0) * 100)}%`, hot: true }
      ]
    },
    {
      title: '战斗',
      rows: [
        { label: '攻击力加成', value: change(s.damage, base.damage), hot: true },
        { label: '攻击速度', value: change(base.fireInterval, s.fireInterval), hot: true },
        { label: '暴击率', value: `+${Math.round((s.critChance || 0) * 100)}%`, hot: true },
        { label: '暴击伤害', value: `${Math.round((s.critMult || 2) * 100)}%` }
      ]
    },
    {
      title: '其他',
      rows: [
        {
          label: '专属技能',
          value:
            (run.character && run.character.skill && run.character.skill.name) || '—',
          hot: true
        },
        { label: '拾取范围', value: change(s.pickupRadius, base.pickupRadius), hot: true },
        { label: '幸运', value: String(s.luck || 0), hot: true }
      ]
    }
  ];
}

/// Opens the sheet on `scene` and returns a handle with `close()`.
export function openStatsPanel(scene) {
  const run = scene.scene.get('Game');
  if (!run || !run.state) return null;

  const W = viewSize(scene).width;
  const H = viewSize(scene).height;
  const s = computeLayout(W, H).uiScale;

  const items = [];
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    for (const item of items) item.destroy();
    items.length = 0;
  };

  haptic('tick');

  const dim = scene.add
    .rectangle(W / 2, H / 2, W, H, 0x03060a, 0.5)
    .setDepth(30)
    .setInteractive();
  dim.on('pointerdown', () => close());
  items.push(dim);

  const panelW = Math.min(W - 36, 344 * s);
  const panelH = Math.round(292 * s);
  const left = W / 2 - panelW / 2;
  const top = H / 2 - panelH / 2;
  const cut = Math.round(14 * s);

  const g = scene.add.graphics().setDepth(31);
  const path = () => {
    g.beginPath();
    g.moveTo(left + cut, top);
    g.lineTo(left + panelW - cut, top);
    g.lineTo(left + panelW, top + cut);
    g.lineTo(left + panelW, top + panelH - cut);
    g.lineTo(left + panelW - cut, top + panelH);
    g.lineTo(left + cut, top + panelH);
    g.lineTo(left, top + panelH - cut);
    g.lineTo(left, top + cut);
    g.closePath();
  };

  path();
  g.fillStyle(0x0b1220, 0.82);
  g.fillPath();

  for (const [width, alpha] of [
    [9, 0.08],
    [3.5, 0.28],
    [1.5, 0.75]
  ]) {
    path();
    g.lineStyle(width, 0x2bd3c4, alpha);
    g.strokePath();
  }

  // A spark along the top edge, like the shop's cards.
  g.lineStyle(2, 0x39e6cd, 0.7);
  g.lineBetween(left + cut, top, left + panelW - cut, top);
  items.push(g);

  // Taps on the sheet do nothing; only its edge closes it, so the buttons keep
  // their own taps.
  const shield = scene.add
    .zone(W / 2, H / 2, panelW, panelH)
    .setDepth(31)
    .setInteractive();
  shield.on('pointerdown', () => {});
  items.push(shield);

  const title = scene.add
    .text(left + 20 * s, top + 26 * s, '角色属性', {
      fontFamily: FONT,
      fontSize: `${Math.round(18 * s)}px`,
      color: COLORS.ink,
      fontStyle: 'bold'
    })
    .setOrigin(0, 0.5)
    .setDepth(32);
  title.setShadow(0, 0, '#2bd3c4', 10, true, true);
  items.push(title);

  const closeButton = makeButton(scene, {
    x: left + panelW - 26 * s,
    y: top + 26 * s,
    width: 34 * s,
    height: 32 * s,
    label: '×',
    fontSize: Math.round(18 * s),
    accent: 0xff2fd0,
    depth: 32,
    onPress: () => close()
  });
  items.push(...closeButton.items);

  // Two columns: survival and misc on the left, offence on the right.
  const pad = 20 * s;
  const colW = (panelW - pad * 3) / 2;
  const columns = [
    { x: left + pad, y: top + 58 * s },
    { x: left + pad * 2 + colW, y: top + 58 * s }
  ];

  const groups = statGroups(run);
  const drawGroup = (group, column) => {
    const header = scene.add
      .text(column.x, column.y, group.title, {
        fontFamily: FONT,
        fontSize: `${Math.round(11 * s)}px`,
        color: '#39e6cd',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(32);
    header.setShadow(0, 0, '#2bd3c4', 6, true, true);
    items.push(header);
    column.y += 20 * s;

    for (const row of group.rows) {
      const label = scene.add
        .text(column.x, column.y, row.label, {
          fontFamily: FONT,
          fontSize: `${Math.round(11.5 * s)}px`,
          color: COLORS.dim
        })
        .setOrigin(0, 0.5)
        .setDepth(32);
      items.push(label);

      const value = scene.add
        .text(column.x + colW, column.y, row.value, {
          fontFamily: FONT,
          fontSize: `${Math.round(12 * s)}px`,
          color: row.hot ? '#ffe66d' : COLORS.ink,
          fontStyle: 'bold'
        })
        .setOrigin(1, 0.5)
        .setDepth(32);
      items.push(value);

      column.y += 21 * s;
    }

    column.y += 10 * s;
  };

  drawGroup(groups[0], columns[0]);
  drawGroup(groups[2], columns[0]);
  drawGroup(groups[1], columns[1]);

  sharpenText(scene);

  return { close, items };
}
