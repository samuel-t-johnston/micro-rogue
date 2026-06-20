export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// Two rooms sharing a wall, with a door at the floor opening (col 5, row 3). The player starts on the
// up-stairs (the dungeon exit) in the lower room; on the return trip from below they arrive on the
// stairs-down in the upper room and must cross back to the exit to win. Entities are authored below
// and placed by stage-place-static-entities.
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
  { type: 'dungeonExit', x: 6, y: 4 }, // lower room: surface up-stairs — the player's start tile and the win tile
  { type: 'stairsDown', x: 6, y: 1 }, // upper room, past the door — the descent to floor 2 (and the return-trip arrival)

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
