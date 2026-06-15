// A "static choice" pipeline: randomly selects one of the hand-authored maze rooms (seeded) and
// places its authored entities. See docs/design/map-generation.md ("Static choice") and
// docs/howto/static-map-layouts.md.
export default {
  id: 'random-static-maze',
  stages: [
    { type: 'randomStatic', layouts: ['maze-spiral', 'maze-zigzag', 'maze-pillars'] },
    { type: 'placeStaticEntities' },
  ],
};
