import { describe, it, expect, beforeEach } from 'vitest';
import { executeSearch } from './action-search.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { createSecretDoor } from '../../world/entities/furniture.js';
import { components } from '../../world/entities/components.js';
import { gameLog } from '../../engine/log/game-log.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 1;
  level.tiles = [['floor', 'wall', 'wall', 'wall', 'wall']];
  return level;
}

function makeActor(registry, level) {
  const actor = registry.createEntity();
  registry.addComponent(actor, 'position', components.position(0, 0));
  level.placeEntity(actor);
  return actor;
}

const displays = () =>
  gameLog
    .getAll()
    .filter((e) => e.display)
    .map((e) => e.display);

const alwaysHit = { random: () => 0 };
const alwaysMiss = { random: () => 0.999 };

describe('executeSearch', () => {
  let registry, level, actor;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    actor = makeActor(registry, level);
  });

  it('consumes the turn', async () => {
    expect(
      await executeSearch(actor, { type: 'search' }, level, registry, { rng: alwaysMiss }),
    ).toBe(false);
  });

  it('reveals a nearby secret and reports the discovery', async () => {
    const secret = createSecretDoor(registry, 1, 0, { revealFloor: 'floor' });
    level.placeEntity(secret);

    await executeSearch(actor, { type: 'search' }, level, registry, { rng: alwaysHit });

    expect(secret.components.has('secret')).toBe(false);
    expect(displays()).toContain('You discover a hidden door!');
  });

  it('reports finding nothing when the search reveals no secret', async () => {
    const secret = createSecretDoor(registry, 1, 0, { revealFloor: 'floor' });
    level.placeEntity(secret);

    await executeSearch(actor, { type: 'search' }, level, registry, { rng: alwaysMiss });

    expect(secret.components.has('secret')).toBe(true);
    expect(displays()).toContain('You search but find nothing.');
  });
});
