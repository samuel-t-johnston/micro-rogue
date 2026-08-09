// The shipped procedural pipeline: a Rogue-style 3x3 room-grid dungeon. Planner (roomGridGeometry →
// label → link) builds the zone graph in the blackboard; realization (carveRooms → carveHalls) turns
// it into tiles; then stairs and populate place the exits and the contents (the creature roster
// below), and scaleCreatures + loadout level and arm those creatures. The player arrives on the
// up-stair (resolveArrival), so no separate arrival marker is placed.
// See docs/design/procedural-3x3-dungeon.md and docs/howto/dynamic-map-generation.md.
export default {
  id: 'procedural-3x3',
  stages: [
    { type: 'roomGridGeometry' },
    // Explicit label list (extends stage-label's default) so the deepest floor also reserves a room
    // for the Amulet of Yendor — stage-populate drops it in the 'amulet'-labelled zone. No
    // 'stairs-down': this is the bottom of the branch, so it gets an up-stair only.
    { type: 'label', labels: ['stairs-up', 'treasure', 'item', 'item', 'amulet'] },
    { type: 'link' },
    { type: 'carveRooms' },
    { type: 'carveHalls' },
    // Hide some corridor doors as secret doors. Scope 'all' may seal the SOLE path to a room, so on this
    // bottom floor the amulet room or the lone up-stair can end up behind a secret — a deliberate
    // "search for the way out" climax. Never a hard lock: a secret is a latent passage, always
    // revealable by searching the wall from the reachable side (and passive search rolls every turn).
    // See docs/design/secret-doors-and-search.md §7.
    { type: 'secretDoors', chance: 0.2, scope: 'all' },
    { type: 'stairs', stairs: [['stairs-up', 'up']] },
    // The shipped creature roster: who spawns and their room-affinity weights (per-label multipliers;
    // a room's pick-weight is the product over its labels). Item counts fall to stage-populate defaults.
    {
      type: 'populate',
      creatures: [
        { type: 'orcCommander', count: 1, weights: { treasure: 5, item: 2 } }, // leads the orcs
        { type: 'orc', count: 2, weights: { treasure: 5, item: 2 } }, // affinity
        { type: 'goblin', count: 2, weights: { treasure: 0.2, item: 0.2 }, separate: true }, // aversion, distinct rooms
      ],
    },
    // Third floor: bump this floor's monsters to level 3.
    { type: 'scaleCreatures', levels: { goblin: 3, orc: 3, scuttler: 3, orcCommander: 3 } },
    // Arms the placed creatures from item tables (orcs → spear, commander → bow + arrows).
    { type: 'loadout' },
  ],
};
