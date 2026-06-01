import { components } from '../../components.js';

// Temporary stage: places a single boulder near the room centre for testing.
// Replace with a proper population stage (see roadmap M5) once map gen matures.
export async function run(level, _stageConfig, _blackboard, _rng, registry) {
  const cx = Math.floor(level.width / 2);
  const cy = Math.floor(level.height / 2);

  const boulder = registry.createEntity();
  registry.addComponent(boulder, 'name', components.name('Boulder'));
  registry.addComponent(boulder, 'position', components.position(cx + 2, cy));
  registry.addComponent(boulder, 'blocksMovement', components.blocksMovement());
  registry.addComponent(boulder, 'opaque', components.opaque());
  registry.addComponent(boulder, 'renderable', components.renderable(
    { col: 16, row: 12 }, // small column base sprite (1-indexed: col 17, row 13)
    '#888888',
  ));
  level.placeEntity(boulder);
}
