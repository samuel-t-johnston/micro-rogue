// The first procedural pipeline: a Rogue-style 3x3 room-grid dungeon.
// Planner (geometry → label → link) builds the zone graph in the blackboard; realization
// (carveRooms) turns it into tiles; spawn marks the player's arrival. Halls, stairs, and
// population land in later slices. See docs/design/procedural-3x3-dungeon.md.
export default {
  id: 'procedural-3x3',
  stages: [
    { type: 'roomGridGeometry' },
    { type: 'label' },
    { type: 'link' },
    { type: 'carveRooms' },
    { type: 'spawn' },
  ],
};
