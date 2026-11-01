// The game's icons, from the bundled symbol library (vendor/symbols.js, the
// full Lucide set): every Lucide name just works — no lookup, no drawing.
//
// In a scene's preload():   registerIcons(this, ['play', 'pause', 'rotate-ccw']);
// then draw the texture:    this.add.image(x, y, 'icon-play');
//
// Icons are rasterized synchronously onto canvas textures with the Canvas 2D
// API. Never load an icon through the Phaser file loader as an SVG data URI:
// decoding it throws InvalidCharacterError on the WebKit runtime, uncaught,
// and kills the game before the first frame.

import { SYMBOLS } from '../vendor/symbols.js';

/// One symbol as an SVG data URI, for DOM overlays only (e.g. CSS
/// `background-image`). Do NOT hand this to `scene.load.svg` — see above.
export function iconDataURI(name, color = '#ffffff') {
  const symbol = SYMBOLS[name];
  if (!symbol) return null;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${symbol}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/// Creates each named symbol as a texture `icon-<name>`, synchronously — the
/// textures exist the moment this returns, so it works from preload() or
/// create(). Unknown names warn instead of failing, so a typo shows up in
/// the runtime log rather than a blank sprite.
export function registerIcons(scene, names, size = 96, color = '#ffffff') {
  for (const name of names) {
    const key = `icon-${name}`;
    if (scene.textures.exists(key)) continue;

    const markup = SYMBOLS[name];
    if (!markup) {
      console.warn(`Icon "${name}" is not a bundled symbol.`);
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Lucide glyphs live in a 24x24 viewBox and are stroke-based (fill:
    // none), so scaling the context and stroking reproduces them exactly.
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokeSymbol(ctx, markup);
    scene.textures.addCanvas(key, canvas);
  }
}

// Lucide markup is a flat list of self-closed elements; these seven tags are
// every kind the library contains.
function strokeSymbol(ctx, markup) {
  for (const element of markup.matchAll(/<(\w+)([^>]*?)\/>/g)) {
    const tag = element[1];
    const a = {};
    for (const attribute of element[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
      a[attribute[1]] = attribute[2];
    }

    ctx.beginPath();
    switch (tag) {
      case 'path':
        if (a.d) ctx.stroke(new Path2D(a.d));
        continue;
      case 'circle':
        ctx.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
        break;
      case 'ellipse':
        ctx.ellipse(+a.cx, +a.cy, +a.rx, +a.ry, 0, 0, Math.PI * 2);
        break;
      case 'rect': {
        const rx = +(a.rx ?? a.ry ?? 0);
        ctx.roundRect(+a.x, +a.y, +a.width, +a.height, rx);
        break;
      }
      case 'line':
        ctx.moveTo(+a.x1, +a.y1);
        ctx.lineTo(+a.x2, +a.y2);
        break;
      case 'polyline':
      case 'polygon': {
        const points = (a.points ?? '').trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i + 1 < points.length; i += 2) {
          if (i === 0) ctx.moveTo(points[i], points[i + 1]);
          else ctx.lineTo(points[i], points[i + 1]);
        }
        if (tag === 'polygon') ctx.closePath();
        break;
      }
      default:
        continue;
    }
    ctx.stroke();
  }
}
