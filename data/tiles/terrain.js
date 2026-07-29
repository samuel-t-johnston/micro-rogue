// Tile types.
// `sprite` is a catalog name (data/sprites/sprite-catalog.js);
// `glyph`/`glyphColor` are the ASCII-mode rendering (and the sprite-mode fallback).
// `symbol` is the legacy text-map character used by generation/visualization tooling.
// `category` is the generation-facing role ('floor' | 'wall'): the map-generation pipeline reads and
// writes tiles by category (via a palette), never by tile id, so a cave floor and a stone floor are
// interchangeable to a carve stage. It's a small closed vocabulary with room to grow ('water', 'pit'…).
export default {
  floor: {
    name: 'Floor',
    symbol: '.',
    glyph: '.',
    glyphColor: '#3a3833',
    color: '#7a7a6e',
    blocksMovement: false,
    opaque: false,
    category: 'floor',
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
    category: 'wall',
    sprite: 'wall',
  },
  'cave-floor': {
    name: 'Cave Floor',
    symbol: ',',
    glyph: '.',
    glyphColor: '#2f3540',
    color: '#5b6672',
    blocksMovement: false,
    opaque: false,
    category: 'floor',
    sprite: 'cave-floor',
  },
  'cave-wall': {
    name: 'Cave Wall',
    symbol: '%',
    glyph: '#',
    glyphColor: '#3f4a52',
    color: '#8a97a0',
    blocksMovement: true,
    opaque: true,
    category: 'wall',
    sprite: 'cave-wall',
  },
};
