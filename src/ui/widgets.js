// A wide, tappable button in the game's palette: a rounded panel with an
// optional Lucide symbol and an optional label. Input is handled by a Zone on
// top, which is a plain rectangle hit area and never fights the graphics.
//
// Returns { items, zone } so callers can show or hide the whole button at once.

import { FONT } from './style.js';

export function makeButton(scene, opts) {
  const {
    x,
    y,
    width,
    height,
    icon = null,
    label = '',
    accent = 0x39e6cd,
    fill = 0x141c28,
    fontSize = 17,
    depth = 10,
    onPress
  } = opts;

  const radius = Math.min(height / 2, 18);
  const left = x - width / 2;
  const top = y - height / 2;
  const items = [];

  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(fill, 0.96);
  g.fillRoundedRect(left, top, width, height, radius);
  g.lineStyle(2, accent, 0.6);
  g.strokeRoundedRect(left, top, width, height, radius);
  items.push(g);

  const iconSize = Math.min(height * 0.5, 26);
  if (icon) {
    const img = scene.add
      .image(label ? left + height * 0.52 : x, y, `icon-${icon}`)
      .setDisplaySize(iconSize, iconSize)
      .setTint(accent)
      .setDepth(depth);
    items.push(img);
  }

  if (label) {
    const text = scene.add
      .text(icon ? left + height * 0.95 : x, y, label, {
        fontFamily: FONT,
        fontSize: `${fontSize}px`,
        color: '#eafcff',
        fontStyle: '600'
      })
      .setOrigin(icon ? 0 : 0.5, 0.5)
      .setDepth(depth);
    items.push(text);
  }

  const zone = scene.add.zone(x, y, width, height).setInteractive();
  zone.on('pointerdown', () => {
    if (onPress) onPress();
  });
  items.push(zone);

  return { items, zone };
}
