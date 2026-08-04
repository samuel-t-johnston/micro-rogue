export const legend = {
  '.': 'floor',
  '#': 'wall',
};

// Two rooms sharing a wall, with a door at the floor opening (col 5, row 3). The player starts on the
// up-stairs (the dungeon exit) in the lower room. A hidden 3×3 closet (cols 12–14, rows 4–6) hangs off
// the lower room's east wall, reachable ONLY through a secret door at (11, 5): that tile is authored as
// plain wall here and carries a `secretDoor` entity (below), so it looks and behaves like wall until a
// search reveals it (see docs/design/secret-doors-and-search.md). Entities are placed by
// stage-place-static-entities.
export const tiles = `\
################
#..........#####
#..........#####
#####.##########
#..........#...#
#..........#...#
#..........#...#
#..........#####
################`;

export const entities = [
  { type: 'dungeonExit', x: 6, y: 4 }, // lower room: surface up-stairs — the player's start tile and the win tile
  // Two descents from floor 1, distinguished by their transit-map port (see data/transit-map.js):
  { type: 'stairsDown', x: 6, y: 1, port: 'down' }, // upper room, past the door — down the main stack to floor 2
  { type: 'stairsDown', x: 9, y: 7, port: 'branch1' }, // start room — into branch 1 (the BSP floor)

  { type: 'boulder', x: 8, y: 4 },
  { type: 'door', x: 5, y: 3 },
  // Secret door into the hidden closet (revealed by searching); its tile is wall until found.
  { type: 'secretDoor', x: 11, y: 5 },
  // The closet's reward — the reason the secret is worth finding.
  { type: 'chest', x: 13, y: 5, contents: ['healingPotion', 'scroll', 'leatherArmor'] },
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
