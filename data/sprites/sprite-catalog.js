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
  knight: [16],
  potions: [16],
  weapons: [16],
  consumables: [16],
  chests: [16],
  books: [16],
  armours: [16],
  glionox_items_sheet: [16],
};

// name -> { sheet, col, row }. col/row are 0-indexed grid cells (size-agnostic: the same cell
// addresses the same logical sprite on every size of its sheet). Keep names kebab-case.
export const SPRITES = {
  // Terrain
  floor: { sheet: 'sprite-sheet', col: 2, row: 0 },
  wall: { sheet: 'sprite-sheet', col: 1, row: 5 },

  // Items
  'healing-potion': { sheet: 'sprite-sheet', col: 16, row: 16 },
  'potion-of-pain': { sheet: 'sprite-sheet', col: 20, row: 16 },
  dagger: { sheet: 'sprite-sheet', col: 19, row: 5 },

  // Furniture
  boulder: { sheet: 'sprite-sheet', col: 16, row: 12 },
  chest: { sheet: 'sprite-sheet', col: 10, row: 23 },
  'door-closed': { sheet: 'sprite-sheet', col: 16, row: 22 },
  'door-open': { sheet: 'sprite-sheet', col: 17, row: 22 },
};
