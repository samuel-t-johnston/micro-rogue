export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// A boustrophedon zig-zag: vertical corridors joined alternately at top and bottom, so one path
// snakes from the top-left corner down/up/down across to the bottom-right corner.
// Up-stairs (player entry) in the start corner; down-stairs at the far end.
export const tiles = `\
###############
#.#...#...#...#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#.#.#.#.#.#.#.#
#...#...#...#.#
###############`;

export const entities = [
  { type: 'stairsUp', x: 1, y: 1 },
  { type: 'stairsDown', x: 13, y: 13 },
  { type: 'healingPotion', x: 5, y: 5 },
  { type: 'dagger', x: 11, y: 9 },
  { type: 'bread', x: 7, y: 1 },
  { type: 'orc', x: 3, y: 7 },
  { type: 'orc', x: 9, y: 7 },
];
