export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// A regular lattice of single-tile pillars, each with one floor space on every side. One pillar
// spot near the centre is left open for a chest instead. Up-stairs (player entry) and down-stairs
// sit in opposite corners.
export const tiles = `\
###############
#.............#
#.#.#.#.#.#.#.#
#.............#
#.#.#.#.#.#.#.#
#.............#
#.#.#.#.#.#.#.#
#.............#
#.#.#.#...#.#.#
#.............#
#.#.#.#.#.#.#.#
#.............#
#.#.#.#.#.#.#.#
#.............#
###############`;

export const entities = [
  { type: 'stairsUp', x: 1, y: 1 },
  { type: 'stairsDown', x: 13, y: 13 },
  { type: 'chest', x: 8, y: 8, contents: ['sword', 'leatherArmor'] },
  { type: 'healingPotion', x: 5, y: 5 },
  { type: 'scroll', x: 9, y: 9 },
  { type: 'scuttler', x: 3, y: 3 },
  { type: 'scuttler', x: 11, y: 3 },
  { type: 'scuttler', x: 7, y: 7 },
  { type: 'scuttler', x: 3, y: 11 },
  { type: 'scuttler', x: 11, y: 11 },
];
