import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createOrc, createOrcCommander, createScuttler } from '../../entities/creatures.js';
import { run, byType, byFaction, byName, all } from './stage-loadout.js';
import { item } from '../../entities/item-tables.js';

// The stage ignores `level`/`blackboard`/`rng` for static loadouts; pass throwaways.
const place = (registry, stageConfig) => run(null, stageConfig, null, null, registry);

const inventoryTypes = (creature) =>
  creature.components.get('inventory').items.map((i) => i.components.get('entityTypeId'));

describe('stage-loadout', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('arms a creature with its matching rule via default loadouts', () => {
    const commander = createOrcCommander(registry, 0, 0);
    place(registry);
    expect(inventoryTypes(commander)).toEqual(['bow', 'arrow']);
  });

  it('gives the orc a spear and the commander the bow kit (first match wins)', () => {
    const orc = createOrc(registry, 0, 0);
    const commander = createOrcCommander(registry, 1, 0);
    place(registry);
    expect(inventoryTypes(orc)).toEqual(['spear']);
    expect(inventoryTypes(commander)).toEqual(['bow', 'arrow']);
  });

  it('sets a stackable item count from the spec', () => {
    const orc = createOrc(registry, 0, 0);
    place(registry, { rules: [{ filter: all(), items: () => [item('arrow', 30)] }] });
    const arrow = orc.components.get('inventory').items[0];
    expect(arrow.components.get('entityTypeId')).toBe('arrow');
    expect(arrow.components.get('stackable').count).toBe(30);
  });

  it('places N separate copies of a non-stackable item', () => {
    const orc = createOrc(registry, 0, 0);
    place(registry, { rules: [{ filter: all(), items: () => [item('potionOfPain', 3)] }] });
    expect(inventoryTypes(orc)).toEqual(['potionOfPain', 'potionOfPain', 'potionOfPain']);
  });

  it('skips creatures with no inventory', () => {
    const scuttler = createScuttler(registry, 0, 0);
    place(registry, { rules: [{ filter: all(), items: () => [item('spear')] }] });
    expect(scuttler.components.has('inventory')).toBe(false);
  });

  it('leaves a creature matching no rule empty-handed', () => {
    const orc = createOrc(registry, 0, 0);
    place(registry, { rules: [{ filter: byType('orcCommander'), items: () => [item('bow')] }] });
    expect(inventoryTypes(orc)).toEqual([]);
  });

  it('filters by faction and by name', () => {
    const orc = createOrc(registry, 0, 0);
    const commander = createOrcCommander(registry, 1, 0);
    expect(byFaction('orcs')(orc)).toBe(true);
    expect(byName('Orc Commander')(commander)).toBe(true);
    expect(byName('Orc Commander')(orc)).toBe(false);
  });
});
