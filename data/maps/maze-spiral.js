export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// A square spiral: a single corridor winds from the top-left corner inward to the centre.
// Up-stairs (player entry) sit in the corner; down-stairs at the heart of the spiral.
export const tiles = `\
###############
#.............#
#############.#
#...........#.#
#.#########.#.#
#.#.......#.#.#
#.#.#####.#.#.#
#.#.#...#.#.#.#
#.#.#.###.#.#.#
#.#.#.....#.#.#
#.#.#######.#.#
#.#.........#.#
#.###########.#
#.............#
###############`;

export const entities = [
  { type: 'stairsUp', x: 1, y: 1 },
  { type: 'stairsDown', x: 7, y: 7 },
  { type: 'healingPotion', x: 11, y: 3 },
  { type: 'sword', x: 3, y: 11 },
  { type: 'orc', x: 13, y: 2 },
  { type: 'orc', x: 1, y: 13 },
];
