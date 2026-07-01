export default {
  id: 'static-test-level',
  stages: [
    { type: 'static', layout: 'floor-1-a' },
    { type: 'placeStaticEntities' },
    // Arms placed creatures from item tables
    { type: 'loadout' },
  ],
};
