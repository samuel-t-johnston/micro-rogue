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
    glyphColor: '#202020',
    color: '#7a7a7a',
    blocksMovement: false,
    opaque: false,
    category: 'floor',
    sprite: 'floor',
  },
  wall: {
    name: 'Wall',
    symbol: '#',
    glyph: '#',
    glyphColor: '#202020',
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
    glyphColor: '#202020',
    color: '#978145',
    blocksMovement: false,
    opaque: false,
    category: 'floor',
    sprite: 'cave-floor',
  },
  'cave-wall': {
    name: 'Cave Wall',
    symbol: '%',
    glyph: '#',
    glyphColor: '#202020',
    color: '#978145',
    blocksMovement: true,
    opaque: true,
    category: 'wall',
    sprite: 'cave-wall',
  },
};
