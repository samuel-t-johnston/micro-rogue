// The single source of truth for sprite art (roadmap M8). Every drawable sprite is named here and
// maps to a sheet + grid cell; renderables and tiles reference sprites by name, never by raw
// coordinates. See docs/howto/sprite-sheets.md.
//
// SHEETS declares each sprite sheet's available pixel sizes. A sheet file is named
// `${name}-${size}.png` (e.g. sprite-sheet-32.png, knight-16.png). A sheet may ship at several
// sizes ("families" — same art, different resolution) so the renderer can pick the crispest one
// for the current zoom/DPR (see pickSheetSize), but a single size is fine — most sheets ship at
// one. Only sheets actually referenced by SPRITES are loaded.
export const SHEETS = {
  'sprite-sheet': [16, 32],
  'ProjectUtumnoFull-DCSS': [32], // 64×95 grid of 32px sprites (DCSS variant of ProjectUtumno Full)
};

// name -> { sheet, col, row }. col/row are 0-indexed grid cells (size-agnostic: the same cell
// addresses the same logical sprite on every size of its sheet). Keep names kebab-case.
export const SPRITES = {
  // Terrain
  floor: { sheet: 'sprite-sheet', col: 2, row: 0 },
  wall: { sheet: 'sprite-sheet', col: 1, row: 5 },

  // Items
  'healing-potion': { sheet: 'ProjectUtumnoFull-DCSS', col: 26, row: 42 },
  'potion-of-pain': { sheet: 'ProjectUtumnoFull-DCSS', col: 10, row: 42 },
  'amulet-of-yendor': { sheet: 'ProjectUtumnoFull-DCSS', col: 34, row: 35 },
  'scroll-of-healing': { sheet: 'ProjectUtumnoFull-DCSS', col: 44, row: 43 },

  // Equipment
  dagger: { sheet: 'ProjectUtumnoFull-DCSS', col: 4, row: 45 },
  'leather-armor': { sheet: 'ProjectUtumnoFull-DCSS', col: 51, row: 37 },
  sword: { sheet: 'ProjectUtumnoFull-DCSS', col: 3, row: 46 },

  // Furniture
  boulder: { sheet: 'sprite-sheet', col: 16, row: 12 },
  chest: { sheet: 'sprite-sheet', col: 10, row: 23 },
  'door-closed': { sheet: 'sprite-sheet', col: 16, row: 22 },
  'door-open': { sheet: 'sprite-sheet', col: 17, row: 22 },

  // Player
  player: { sheet: 'ProjectUtumnoFull-DCSS', col: 19, row: 68 },

  // Monsters
  scuttler: { sheet: 'ProjectUtumnoFull-DCSS', col: 37, row: 63 },
  goblin: { sheet: 'ProjectUtumnoFull-DCSS', col: 1, row: 60 },
  orc: { sheet: 'ProjectUtumnoFull-DCSS', col: 27, row: 61 },
  'orc-commander': { sheet: 'ProjectUtumnoFull-DCSS', col: 26, row: 61 },

  // Stairs
  'stairs-up': { sheet: 'ProjectUtumnoFull-DCSS', col: 54, row: 11 },
  'stairs-down': { sheet: 'ProjectUtumnoFull-DCSS', col: 53, row: 11 },
};
