// The panel can be any shape, so every scene derives its geometry from the
// current game size instead of assuming one. The arena is the whole screen now:
// movement is a floating stick wherever the thumb lands, and the only fixed
// control is the dash button tucked into the bottom-right corner.

export function computeLayout(width, height) {
  // Text has to read comfortably on a phone, so the whole UI is built a little
  // larger than the raw panel ratio and the floor is raised to keep small
  // screens legible.
  const uiScale = Phaser.Math.Clamp((Math.min(width, height) / 420) * 1.1, 0.9, 1.6);
  const pad = Math.round(18 + 4 * Phaser.Math.Clamp(width / 420, 0.8, 1.4));

  const dashRadius = Phaser.Math.Clamp(height * 0.088, 34, 58);
  const inset = dashRadius + 26;
  const dashY = height - inset - 8;

  // Keep the player out from under the HUD: the top strip plus the wave clock.
  const playTop =
    Math.max(44, Math.round(height * 0.062)) +
    Math.round(72 * uiScale) +
    Math.round(56 * uiScale);

  return {
    width,
    height,
    uiScale,
    pad,
    // Leave real room at the top for the phone's notch / status area, so the
    // HUD strip is never partly hidden underneath it.
    topInset: Math.max(44, Math.round(height * 0.062)),
    // The part of the arena the player may actually walk in.
    play: {
      left: 10,
      top: playTop,
      right: width - 10,
      bottom: height - 10
    },
    fieldHeight: height,
    field: new Phaser.Geom.Rectangle(0, 0, width, height),
    // Only the ring drawn under a moving thumb uses this.
    joystick: {
      x: width / 2,
      y: height / 2,
      radius: Phaser.Math.Clamp(height * 0.085, 36, 56)
    },
    dash: {
      x: width - inset,
      y: dashY,
      radius: dashRadius
    }
  };
}
