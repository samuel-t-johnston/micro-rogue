// The cellular-automata branch floor: an organic cave built by the CA pipeline (caSeed → caSmooth →
// caBridge → segmentRegions), then the usual shared tail. The deepest floor of the game's second
// branch (data/transit-map.js), reached from the walker floor's down-stair. Being the branch's leaf it
// places only an up-stair (back to the walker floor). segmentRegions infers the chamber/passage zones
// that label/stairs/spawn/populate consume — the same contract BSP and the walker produce. See
// docs/design/organic-map-generation.md and docs/howto/dynamic-map-generation.md.
export default {
  id: 'ca',
  stages: [
    { type: 'caSeed', width: 56, height: 40 },
    { type: 'caSmooth' },
    { type: 'caBridge' },
    { type: 'segmentRegions' },
    // A couple of treasure chambers; every other chamber holds loot (fill). Passages are skipped by
    // label/populate automatically (kind !== 'chamber').
    { type: 'label', labels: ['stairs-up', 'treasure', 'treasure'], fill: 'item' },
    // Leaf of the branch: only an up-stair, wired back to the walker floor's 'down' port.
    { type: 'stairs', stairs: [['stairs-up', 'up']] },
    { type: 'spawn' },
    {
      type: 'populate',
      creatures: [
        { type: 'orc', count: 4, weights: { treasure: 4, item: 1.5 } },
        { type: 'scuttler', count: 4, weights: { treasure: 2 } },
        { type: 'goblin', count: 4, weights: { treasure: 0.3 }, separate: true },
      ],
      itemRoom: { floorItems: [1, 2] },
      treasureRoom: { chestItems: [2, 4], floorItems: [1, 2] },
    },
    { type: 'scaleCreatures', levels: { goblin: 4, orc: 4, scuttler: 4 } },
    { type: 'loadout' },
  ],
};
