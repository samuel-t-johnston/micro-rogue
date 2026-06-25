// Tile types.
// `sprite` is a catalog name (data/sprites/sprite-catalog.js);
// `glyph`/`glyphColor` are the ASCII-mode rendering (and the sprite-mode fallback).
// `symbol` is the legacy text-map character used by generation/visualization tooling.
export default {
  floor: {
    name: 'Floor',
    symbol: '.',
    glyph: '.',
    glyphColor: '#3a3833',
    color: '#7a7a6e',
    blocksMovement: false,
    opaque: false,
    sprite: 'floor',
  },
  wall: {
    name: 'Wall',
    symbol: '#',
    glyph: '#',
    glyphColor: '#5a5448',
    color: '#b0a898',
    blocksMovement: true,
    opaque: true,
    sprite: 'wall',
  },
};
