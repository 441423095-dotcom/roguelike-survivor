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
    // A quiet button is a physical key rather than a lit sign: no halo, a
    // near-black face at half strength and a hairline edge. quietStrength
    // scales the edge brightness so one of a row can read as the primary.
    quiet = false,
    quietStrength = 1,
    textColor = null,
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
    g.fillStyle(
      pressed ? (quiet ? 0x0d1820 : 0x12222e) : fill,
      quiet ? (pressed ? 0.62 : 0.5) : (pressed ? 0.96 : 0.82)
    );
    g.fillPath();

    if (quiet) {
      // Two hairline passes, both dim: enough to read the shape, no tube.
      path();
      g.lineStyle(2.5, accent, (pressed ? 0.3 : 0.16) * quietStrength);
      g.strokePath();

      path();
      g.lineStyle(1.1, accent, (pressed ? 0.62 : 0.34) * quietStrength);
      g.strokePath();
    } else {
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
    }

    // A little spark on the cut corner.
    g.lineStyle(
      2,
      accent,
      quiet ? (pressed ? 0.52 : 0.26) * quietStrength : (pressed ? 1 : 0.7)
    );
    g.lineBetween(right - cut, top, right, top + cut);
  };

  const ink = textColor || (quiet ? '#c2d0d8' : '#eafcff');

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
        color: ink,
        fontStyle: '600'
      })
      .setOrigin(icon ? 0 : 0.5, 0.5)
      .setDepth(depth);
    if (!quiet) text.setShadow(0, 0, '#2bd3c4', 8, true, true);
    items.push(text);
  }

  const zone = scene.add.zone(x, y, width, height).setDepth(depth).setInteractive();

  const setPressed = (pressed) => {
    paint(pressed);
    if (image) image.setAlpha(pressed ? 1 : 0.9);
    if (text) {
      text.setColor(pressed ? '#ffffff' : ink);
      if (!quiet) text.setShadow(0, 0, '#2bd3c4', pressed ? 16 : 8, true, true);
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
