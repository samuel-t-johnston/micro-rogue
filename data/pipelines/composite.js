// The composite branch floor: two structure sections in one level — a BSP keep in the west half and a
// cellular-automata cave in the east — carved into a shared box, joined by `stitch`, and populated per
// district (orcs garrison the keep, goblins and scuttlers infest the cave). The deepest floor of the
// game's second branch (data/transit-map.js), reached from the CA floor's down-stair; a leaf, so it
// places only an up-stair. This is the payoff of the composition machinery: box + appendZones sections
// + stitch + district population, all behind the same tail. See docs/design/organic-map-generation.md.
export default {
  id: 'composite',
  stages: [
    { type: 'box', width: 56, height: 40 },
    // West wing — a BSP keep.
    {
      type: 'bspGeometry',
      bounds: { x: 0, y: 0, w: 28, h: 40 },
      minRoomSize: 6,
      includeHalls: true,
      section: 'keep',
    },
    { type: 'bspCarve', doors: { present: 'all', open: 'none' } },
    // East wing — a CA cave. The palette is sticky, so cave tiles hold from here on (including the
    // stitch corridor that joins the wings); reset it before `stitch` if you want stone plumbing.
    { type: 'palette', floor: 'cave-floor', wall: 'cave-wall' },
    { type: 'caSeed', bounds: { x: 28, y: 0, w: 28, h: 40 } },
    { type: 'caSmooth' },
    { type: 'caBridge' },
    { type: 'segmentRegions', section: 'cave' },
    // Join the two wings so the floor is one connected space.
    { type: 'stitch', maxConnections: 2 },
    // Tuck a secret treasure room into the rock, reachable only by searching. Runs after all carving so
    // its footprint can't be re-floored; it reveals to whichever district floor the door opens onto
    // (stone in the keep, cave in the east). See docs/design/secret-doors-and-search.md §7.
    { type: 'secretRoom' },
    // Label each district on its own, then place the single up-stair in the keep.
    { type: 'label', section: 'keep', labels: ['stairs-up', 'treasure'], fill: 'item' },
    { type: 'label', section: 'cave', labels: ['treasure'], fill: 'item' },
    { type: 'stairs', stairs: [['stairs-up', 'up']] },
    // District population — a garrison in the keep, vermin in the cave.
    {
      type: 'populate',
      section: 'keep',
      creatures: [
        { type: 'orcCommander', count: 1, weights: { treasure: 5 } },
        { type: 'orc', count: 4, weights: { treasure: 4, item: 1.5 } },
      ],
      treasureRoom: { chestItems: [2, 4], floorItems: [1, 2] },
      itemRoom: { floorItems: [1, 2] },
    },
    {
      type: 'populate',
      section: 'cave',
      creatures: [
        { type: 'goblin', count: 5, weights: { treasure: 0.3 }, separate: true },
        { type: 'scuttler', count: 3, weights: { treasure: 2 } },
      ],
      treasureRoom: { chestItems: [1, 3], floorItems: [1, 1] },
      itemRoom: { floorItems: [1, 1] },
    },
    { type: 'scaleCreatures', levels: { goblin: 4, orc: 4, scuttler: 4, orcCommander: 4 } },
    { type: 'loadout' },
  ],
};
