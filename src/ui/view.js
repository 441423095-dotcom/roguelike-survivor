// The canvas is created in device pixels, not in CSS pixels. On a phone the CSS
// size of the panel is only a fraction of the real screen, so a canvas sized in
// CSS pixels gets stretched by the browser — and that stretch is what makes the
// picture, and every glyph in it, look soft.
//
// So the canvas is written at the screen's real density, and each scene's camera
// zooms by the same factor. The game then keeps drawing in the CSS-sized units
// all of its layout is written in, while the picture is rasterised at the
// screen's actual pixel count.
//
// Which is why scenes ask viewSize() instead of reading this.scale.gameSize:
// that one is in device pixels.

// Two is the compromise: a 3x phone still gains most of the sharpness, without
// three times the fill rate the GPU has to push every frame.
export const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/// The size a scene draws in: the canvas in device pixels, back in CSS pixels.
export function viewSize(source) {
  const scale = source && source.scale ? source.scale : source;
  const size = scale && scale.gameSize ? scale.gameSize : null;
  const width = size && size.width ? size.width : 1;
  const height = size && size.height ? size.height : 1;

  return { width: width / DPR, height: height / DPR };
}

/// Without this the scene would draw its CSS-sized layout into a corner of the
/// device-pixel canvas. Every scene calls it once, at the top of create().
export function applyCameraZoom(scene) {
  if (!scene || !scene.cameras || !scene.cameras.main) return;
  scene.cameras.main.setZoom(DPR);
}
