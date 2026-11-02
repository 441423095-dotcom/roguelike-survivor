// Text in Phaser is drawn into its own small canvas at resolution 1 by default,
// and that canvas then gets stretched along with the game canvas — on a phone's
// high density screen that reads as blurry.
//
// Raising the resolution redraws the glyphs at a higher density. Instead of
// touching engine internals, each scene calls this once after it has built its
// UI: it walks the display list and raises the resolution of anything that is a
// Text object. Everything else is skipped.

export const TEXT_RESOLUTION = Math.min(
  2,
  Math.max(1, Math.round(window.devicePixelRatio || 1))
);

export function sharpenText(scene) {
  const list = scene && scene.children && scene.children.list;
  if (!list) return;

  for (let i = 0; i < list.length; i++) {
    const child = list[i];
    if (!child || typeof child.setResolution !== 'function') continue;

    try {
      child.setResolution(TEXT_RESOLUTION);
    } catch (error) {
      // Not a text object after all; leave it alone.
    }
  }
}
