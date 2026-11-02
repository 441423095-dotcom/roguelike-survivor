// Pixel art is code. A sprite is a 2D array of palette indices, drawn once into
// a canvas texture at boot — no image files, no downloads.
//
// Sprites are authored as mirrored halves so a row is always symmetrical and
// easy to count: the right half is the left half reversed.

export function sym(...halves) {
  // Pad to the widest half first so every row still mirrors to the same width
  // even if one is typed a character short.
  const width = Math.max(...halves.map((half) => half.length));

  return halves.map((half) => {
    const padded = half.padEnd(width, '0');
    const left = Array.from(padded, (ch) => parseInt(ch, 36) || 0);
    const right = left.slice().reverse();
    return left.concat(right);
  });
}

/**
 * Renders a 2D pixel matrix as a texture.
 *
 * @param {Phaser.Scene} scene
 * @param {string} key texture key
 * @param {number[][]} pixels rows of palette indices
 * @param {(number|null)[]} palette hex colours by index
 * @param {number} scale how many canvas pixels one art pixel becomes
 */
export function renderPixelArt(scene, key, pixels, palette, scale = 3) {
  if (scene.textures.exists(key)) return;

  const h = pixels.length;
  const w = pixels[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = pixels[y][x];
      const color = palette[idx];
      if (idx === 0 || color == null) continue;
      ctx.fillStyle = `rgb(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  scene.textures.addCanvas(key, canvas);
}
