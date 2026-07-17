export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// Two rooms sharing a wall, with a door at the floor opening (col 5, row 3). The player starts on the
// up-stairs (the dungeon exit) in the lower room. Entities are authored below and placed by stage-place-static-entities.
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
  // Two descents from floor 1, distinguished by their transit-map port (see data/transit-map.js):
  { type: 'stairsDown', x: 6, y: 1, port: 'down' }, // upper room, past the door — down the main stack to floor 2
  { type: 'stairsDown', x: 9, y: 7, port: 'branch1' }, // start room — into branch 1 (the BSP floor)

  { type: 'boulder', x: 8, y: 4 },
  { type: 'door', x: 5, y: 3 },
  { type: 'healingPotion', x: 4, y: 4 },
  { type: 'potionOfPain', x: 4, y: 5 },
  { type: 'healingPotion', x: 4, y: 5 },
  { type: 'dagger', x: 3, y: 4 },
  // Ranged-weapon set added for manual testing (docs/design/ranged-weapons.md, step 9).
  {
    type: 'chest',
    x: 9,
    y: 5,
    contents: ['healingPotion', 'potionOfPain', 'dagger', 'spear', 'javelin', 'bow', 'arrow'],
  },
  { type: 'goblin', x: 3, y: 2 },
  { type: 'orc', x: 8, y: 2 },
];
