// The first procedural pipeline: a Rogue-style 3x3 room-grid dungeon.
// Planner (geometry → label → link) builds the zone graph in the blackboard; realization
// (carveRooms) turns it into tiles; spawn marks the player's arrival. Halls, stairs, and
// population land in later slices. See docs/design/procedural-3x3-dungeon.md.
export default {
  id: 'procedural-3x3',
  stages: [
    { type: 'roomGridGeometry' },
    // Explicit label list (extends stage-label's default) so the deepest floor also reserves a room
    // for the Amulet of Yendor — stage-populate drops it in the 'amulet'-labelled zone.
    { type: 'label', labels: ['stairs-up', 'stairs-down', 'treasure', 'item', 'item', 'amulet'] },
    { type: 'link' },
    { type: 'carveRooms' },
    { type: 'carveHalls' },
    { type: 'stairs' },
    { type: 'spawn' },
    { type: 'populate' },
    // Third floor: bump this floor's monsters to level 3.
    { type: 'scaleCreatures', levels: { goblin: 3, orc: 3, scuttler: 3, orcCommander: 3 } },
    // Arms the placed creatures from item tables (orcs → spear, commander → bow + arrows).
    { type: 'loadout' },
  ],
};
