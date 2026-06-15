export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// Two rooms sharing a wall, with a door at the floor opening (col 5, row 3). Player starts on the
// up-stairs in the lower room. Entities are authored below and placed by stage-place-static-entities.
export const tiles = `\
############
#..........#
#..........#
#####.######
#..........#
#..........#
#..........#
#..........#
############`;

export const entities = [
  { type: 'stairsUp', x: 6, y: 4 },
  { type: 'boulder', x: 8, y: 4 },
  { type: 'door', x: 5, y: 3 },
  { type: 'healingPotion', x: 4, y: 4 },
  { type: 'potionOfPain', x: 4, y: 5 },
  { type: 'healingPotion', x: 4, y: 5 },
  { type: 'dagger', x: 3, y: 4 },
  { type: 'chest', x: 9, y: 5, contents: ['healingPotion', 'potionOfPain', 'dagger'] },
  { type: 'goblin', x: 3, y: 2 },
  { type: 'orc', x: 8, y: 2 },
];
