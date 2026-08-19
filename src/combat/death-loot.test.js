import { describe, it, expect, beforeEach } from 'vitest';
import { dropLoot } from './death-loot.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { createLevel } from '../world/map/level.js';
import { components } from '../world/entities/components.js';
import { rng } from '../engine/core/rng.js';
import { useTables } from '../world/tables/entity-table.js';
import { TABLES } from '../../data/tables/index.js';

// A creature stand-in placed on the level: just the bits loot resolution reads.
function creature(registry, level, typeId, x = 2, y = 2) {
  const e = registry.createEntity();
  registry.addComponent(e, 'entityTypeId', components.entityTypeId(typeId));
  registry.addComponent(e, 'position', components.position(x, y));
  registry.addComponent(e, 'creature', components.creature());
  level.placeEntity(e);
  return e;
}

const itemsAt = (level, x, y) =>
  [...level.getEntitiesAt(x, y)].filter((e) => e.components.get('item'));

describe('dropLoot', () => {
  let registry, level;
  beforeEach(() => {
    registry = createEntityRegistry();
    level = createLevel({ depth: 4 });
    useTables(TABLES); // install the catalog so orcCommanderLoot's ref('potions') resolves
  });

  it('drops nothing for a creature type with no loot table', () => {
    rng.init(1);
    dropLoot(creature(registry, level, 'scuttler'), level, registry);
    expect(itemsAt(level, 2, 2)).toHaveLength(0);
  });

  it('produces identical drops for the same master seed', () => {
    rng.init(123);
    dropLoot(creature(registry, level, 'orcCommander'), level, registry);
    const first = itemsAt(level, 2, 2).map((e) => e.components.get('entityTypeId'));

    const reg2 = createEntityRegistry();
    const lvl2 = createLevel({ depth: 4 });
    rng.init(123);
    dropLoot(creature(reg2, lvl2, 'orcCommander'), lvl2, reg2);
    const second = itemsAt(lvl2, 2, 2).map((e) => e.components.get('entityTypeId'));

    expect(second).toEqual(first);
  });

  it('drops loot on the corpse tile for a creature that has a table', () => {
    // Seeds vary; across a spread at least one orc-commander death (2-3 rolls, mostly non-empty)
    // must leave something, proving the table→placement path works end to end.
    let anyDropped = false;
    for (let seed = 0; seed < 20 && !anyDropped; seed++) {
      const reg = createEntityRegistry();
      const lvl = createLevel({ depth: 4 });
      rng.init(seed);
      dropLoot(creature(reg, lvl, 'orcCommander'), lvl, reg);
      if (itemsAt(lvl, 2, 2).length > 0) anyDropped = true;
    }
    expect(anyDropped).toBe(true);
  });
});
