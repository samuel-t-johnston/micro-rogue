// The BSP branch floor: a large "fully packed" building-style level (binary space partitioning with
// halls), used for the game's second dungeon branch — reached from floor-1's second down-stair
// (data/transit-map.js). Planner+realization is bspGeometry → label → bspCarve; then the usual
// stairs/spawn/populate finish it. Being a leaf branch it places only an up-stair (back to floor-1).
// See docs/howto/dynamic-map-generation.md and docs/design/map-generation.md.
export default {
  id: 'bsp',
  stages: [
    {
      type: 'bspGeometry',
      width: 56,
      height: 40,
      minRoomSize: 6,
      includeHalls: true,
      hallWidth: 1,
      hallLoopChance: 0.5, // a looser, loopier hall network for a big floor
      skipLeafHalls: true, // terminal splits become two-room suites, thinning the corridors
    },
    // A couple of treasure rooms; every other room is an item room (fill), so this big floor is densely
    // looted rather than mostly empty.
    { type: 'label', labels: ['stairs-up', 'treasure', 'treasure'], fill: 'item' },
    { type: 'bspCarve', doors: { present: 'all', open: 'none' } },
    // Leaf branch: only an up-stair, wired back to floor-1's 'branch1' port by the transit map.
    { type: 'stairs', stairs: [['stairs-up', 'up']] },
    { type: 'spawn' },
    {
      type: 'populate',
      creatures: [
        { type: 'orc', count: 3, weights: { treasure: 4, item: 1.5 } },
        { type: 'scuttler', count: 3, weights: { treasure: 2 } },
        { type: 'goblin', count: 4, weights: { treasure: 0.3 }, separate: true },
      ],
      // A big floor holds more loot, and this branch is stocked with food especially — the item pool
      // is weighted heavily toward the three foods (grapes/bread/meat).
      itemRoom: { floorItems: [1, 2] },
      treasureRoom: { chestItems: [2, 4], floorItems: [1, 2] },
      items: { weights: { grapes: 8, bread: 8, meat: 8 } },
    },
    { type: 'scaleCreatures', levels: { goblin: 2, orc: 2, scuttler: 2 } },
    { type: 'loadout' },
  ],
};
