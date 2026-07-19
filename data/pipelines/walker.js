// The walker branch floor: an organic, cave-like level built by the semi-sober walker pipeline
// (layoutNodes → layoutEdges → carveChambers → carveCorridors), then the usual shared tail. Sits one
// step deeper than the BSP floor on the game's second branch (data/transit-map.js), reached from that
// floor's down-stair. Being the branch's deepest floor it places only an up-stair (back to the BSP
// floor). See docs/design/organic-map-generation.md and docs/howto/dynamic-map-generation.md.
export default {
  id: 'walker',
  stages: [
    { type: 'layoutNodes', width: 56, height: 40, nodeCount: 12 },
    { type: 'layoutEdges', loopFactor: 0.25 },
    { type: 'carveChambers' },
    { type: 'carveCorridors' },
    // One up-stair chamber and a couple of treasure chambers; every other chamber holds loot (fill).
    { type: 'label', labels: ['stairs-up', 'treasure', 'treasure'], fill: 'item' },
    // Leaf of the branch: only an up-stair, wired back to the BSP floor's 'down' port by the transit map.
    { type: 'stairs', stairs: [['stairs-up', 'up']] },
    { type: 'spawn' },
    {
      type: 'populate',
      creatures: [
        { type: 'orc', count: 4, weights: { treasure: 4, item: 1.5 } },
        { type: 'scuttler', count: 3, weights: { treasure: 2 } },
        { type: 'goblin', count: 4, weights: { treasure: 0.3 }, separate: true },
      ],
      itemRoom: { floorItems: [1, 2] },
      treasureRoom: { chestItems: [2, 4], floorItems: [1, 2] },
    },
    { type: 'scaleCreatures', levels: { goblin: 3, orc: 3, scuttler: 3 } },
    { type: 'loadout' },
  ],
};
