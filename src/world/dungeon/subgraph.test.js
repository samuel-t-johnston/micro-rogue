import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { components } from '../components.js';
import { collectSubgraph } from './subgraph.js';

// Builds an owner entity carrying `inventory` + `wearsEquipment`, plus the items it holds.
function makeRegistry() {
  return createEntityRegistry();
}

describe('collectSubgraph', () => {
  it('includes the roots themselves', () => {
    const reg = makeRegistry();
    const a = reg.createEntity();
    const b = reg.createEntity();
    const found = collectSubgraph([a, b]);
    expect(found.has(a)).toBe(true);
    expect(found.has(b)).toBe(true);
  });

  it('follows inventory item references', () => {
    const reg = makeRegistry();
    const owner = reg.createEntity();
    reg.addComponent(owner, 'inventory', components.inventory());
    const potion = reg.createEntity();
    owner.components.get('inventory').items.push(potion);

    const found = collectSubgraph([owner]);
    expect(found.has(potion)).toBe(true);
  });

  it('follows worn equipment references and skips empty slots', () => {
    const reg = makeRegistry();
    const owner = reg.createEntity();
    reg.addComponent(owner, 'wearsEquipment', components.wearsEquipment(['weapon', 'armor']));
    const sword = reg.createEntity();
    owner.components.get('wearsEquipment').slots.weapon = sword; // armor stays null

    const found = collectSubgraph([owner]);
    expect(found.has(sword)).toBe(true);
    expect(found.size).toBe(2); // owner + sword, no phantom from the null slot
  });

  it('follows container (chest) contents — same inventory ref path', () => {
    const reg = makeRegistry();
    const chest = reg.createEntity();
    reg.addComponent(chest, 'container', components.container());
    reg.addComponent(chest, 'inventory', components.inventory());
    const gold = reg.createEntity();
    chest.components.get('inventory').items.push(gold);

    const found = collectSubgraph([chest]);
    expect(found.has(gold)).toBe(true);
  });

  it('traverses nested inventories transitively', () => {
    const reg = makeRegistry();
    const owner = reg.createEntity();
    reg.addComponent(owner, 'inventory', components.inventory());
    const bag = reg.createEntity();
    reg.addComponent(bag, 'inventory', components.inventory());
    const trinket = reg.createEntity();
    owner.components.get('inventory').items.push(bag);
    bag.components.get('inventory').items.push(trinket);

    const found = collectSubgraph([owner]);
    expect(found.has(bag)).toBe(true);
    expect(found.has(trinket)).toBe(true);
  });

  it('excludes entities not reachable from the roots', () => {
    const reg = makeRegistry();
    const owner = reg.createEntity();
    reg.addComponent(owner, 'inventory', components.inventory());
    const carried = reg.createEntity();
    owner.components.get('inventory').items.push(carried);
    const unrelated = reg.createEntity();

    const found = collectSubgraph([owner]);
    expect(found.has(unrelated)).toBe(false);
  });

  it('handles reference cycles without looping forever', () => {
    const reg = makeRegistry();
    const a = reg.createEntity();
    const b = reg.createEntity();
    reg.addComponent(a, 'inventory', components.inventory());
    reg.addComponent(b, 'inventory', components.inventory());
    a.components.get('inventory').items.push(b);
    b.components.get('inventory').items.push(a); // contrived cycle

    const found = collectSubgraph([a]);
    expect(found.has(a)).toBe(true);
    expect(found.has(b)).toBe(true);
  });
});
