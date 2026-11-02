// A wide, tappable button in the game's palette, cut like a neon panel: a
// chamfered slab with a glowing outline that flares while a thumb is on it.
// Input is handled by a Zone on top, which is a plain rectangle hit area and
// never fights the graphics.
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
    fill = 0x0a1018,
    fontSize = 17,
    depth = 10,
    onPress
  } = opts;

  const cut = Math.min(12, Math.max(6, Math.round(height * 0.28)));
  const left = x - width / 2;
  const top = y - height / 2;
  const right = x + width / 2;
  const bottom = y + height / 2;
  const items = [];

  const g = scene.add.graphics().setDepth(depth);
  items.push(g);

  // The chamfered slab is drawn as one path and stroked at three widths, which
  // is what reads as a neon tube rather than a box.
  const path = () => {
    g.beginPath();
    g.moveTo(left + cut * 0.6, top);
    g.lineTo(right - cut, top);
    g.lineTo(right, top + cut);
    g.lineTo(right - cut * 0.6, bottom);
    g.lineTo(left + cut, bottom);
    g.lineTo(left, bottom - cut);
    g.closePath();
  };

  const paint = (pressed) => {
    g.clear();

    path();
    g.fillStyle(pressed ? 0x12222e : fill, pressed ? 0.96 : 0.82);
    g.fillPath();

    // Three passes: a wide dim halo, a mid glow, then the bright tube itself.
    path();
    g.lineStyle(9, accent, pressed ? 0.22 : 0.1);
    g.strokePath();

    path();
    g.lineStyle(4, accent, pressed ? 0.5 : 0.26);
    g.strokePath();

    path();
    g.lineStyle(1.5, accent, pressed ? 1 : 0.62);
    g.strokePath();

    // A little spark on the cut corner.
    g.lineStyle(2, accent, pressed ? 1 : 0.7);
    g.lineBetween(right - cut, top, right, top + cut);
  };

  paint(false);

  const iconSize = Math.min(height * 0.5, 26);
  let image = null;
  if (icon) {
    image = scene.add
      .image(label ? left + height * 0.52 : x, y, `icon-${icon}`)
      .setDisplaySize(iconSize, iconSize)
      .setTint(accent)
      .setDepth(depth);
    items.push(image);
  }

  let text = null;
  if (label) {
    text = scene.add
      .text(icon ? left + height * 0.95 : x, y, label, {
        fontFamily: FONT,
        fontSize: `${fontSize}px`,
        color: '#eafcff',
        fontStyle: '600'
      })
      .setOrigin(icon ? 0 : 0.5, 0.5)
      .setDepth(depth);
    text.setShadow(0, 0, '#2bd3c4', 8, true, true);
    items.push(text);
  }

  const zone = scene.add.zone(x, y, width, height).setDepth(depth).setInteractive();

  const setPressed = (pressed) => {
    paint(pressed);
    if (image) image.setAlpha(pressed ? 1 : 0.9);
    if (text) {
      text.setColor(pressed ? '#ffffff' : '#eafcff');
      text.setShadow(0, 0, '#2bd3c4', pressed ? 16 : 8, true, true);
    }
  };

  zone.on('pointerdown', () => {
    setPressed(true);
    if (onPress) onPress();
  });
  zone.on('pointerup', () => setPressed(false));
  zone.on('pointerout', () => setPressed(false));
  items.push(zone);

  return { items, zone, paint: setPressed };
}
