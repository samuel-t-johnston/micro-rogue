// A "static choice" pipeline: randomly selects one of the hand-authored maze rooms (seeded) and
// places its authored entities. See docs/design/map-generation.md ("Static choice") and
// docs/howto/static-map-layouts.md.
export default {
  id: 'random-static-maze',
  stages: [
    { type: 'randomStatic', layouts: ['maze-spiral', 'maze-zigzag', 'maze-pillars'] },
    // Fancy the maze walls into CP437 double-line segments (glyph mode). Runs after the layout is
    // placed and before entities, which don't affect wall analysis. See data/tiles/line-walls.js.
    { type: 'lineWalls' },
    { type: 'placeStaticEntities' },
    // Second floor: bump this floor's monsters to level 2. Types absent from the rolled layout are
    // simply skipped, so one map covers every maze variant.
    { type: 'scaleCreatures', levels: { goblin: 2, orc: 2, scuttler: 2, orcCommander: 2 } },
    // Arms placed creatures from item tables (orcs → spear). No-op on the scuttler 'maze-pillars'
    // layout — they match no rule and carry no inventory.
    { type: 'loadout' },
  ],
};
