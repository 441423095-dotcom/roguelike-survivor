// One palette and one font stack for everything drawn on screen, so the HUD,
// the menus and the arena read as one game.
//
// system-ui first: it resolves to the phone's own interface font (PingFang on
// iOS), which is the crispest sans every device has, with named fallbacks for
// the browsers that do not know the keyword.

export const FONT =
  'system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const COLORS = {
  accent: 0x39e6cd,
  accentHex: '#39e6cd',
  danger: 0xff5a72,
  dangerHex: '#ff5a72',
  gold: 0xffb038,
  goldHex: '#ffb038',
  purple: 0xa884d0,
  panel: 0x0b1018,
  panelLift: 0x141c28,
  ink: '#f5fdff',
  dim: '#b6c7d4'
};
