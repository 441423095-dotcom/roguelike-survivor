// Colours live in styles/main.css so light and dark mode are defined in one
// place. Phaser cannot read CSS variables, so they are resolved here.

/// The raw CSS value, e.g. '#10131a'. Phaser's text styles take strings.
export function themeValue(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/// The same value as a number, e.g. 0x10131a. Cameras, tints and graphics take
/// numbers rather than strings.
export function themeColor(name) {
  return Phaser.Display.Color.ValueToColor(themeValue(name)).color;
}

/// Runs the callback whenever the system flips between light and dark. The CSS
/// variables have already changed by the time it fires.
export function onThemeChange(callback) {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', callback);
}
