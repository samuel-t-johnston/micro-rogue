export default {
  id: 'static-test-level',
  stages: [
    { type: 'static', layout: 'floor-1-a' },
    { type: 'placeStaticEntities' },
    // Arms placed creatures from item tables — the authored orc on floor 1 picks up a spear, so reach
    // attacks are testable immediately. See src/world/generation/stages/stage-loadout.js.
    { type: 'loadout' },
  ],
};
