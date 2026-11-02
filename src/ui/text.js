// Text in Phaser is drawn into its own small canvas, and that canvas is then
// stretched along with the game canvas — on a phone's high density screen that
// reads as blurry. Two things fix it, and each scene calls this once after it
// has built its UI.
//
// First, the glyphs are redrawn at a higher resolution. Secondly, thin strokes
// are what read as "soft" at phone sizes, so any label left at the default
// weight is nudged up to 600 — heavier, but with the counters still open.
//
// It walks the display list and touches only Text objects; everything else is
// skipped.

import { DPR } from './view.js';

export const TEXT_RESOLUTION = Math.max(1, Math.min(2, Math.round(DPR)));

export function sharpenText(scene) {
  const list = scene && scene.children && scene.children.list;
  if (!list) return;

  for (let i = 0; i < list.length; i++) {
    const child = list[i];
    if (!child || typeof child.setResolution !== 'function') continue;

    // Set on the style directly: setFontStyle() would redraw the whole label,
    // and the setResolution() below is going to do that anyway.
    if (child.style && !child.style.fontStyle) child.style.fontStyle = '600';

    try {
      child.setResolution(TEXT_RESOLUTION);
    } catch (error) {
      // Not a text object after all; leave it alone.
    }
  }
}
