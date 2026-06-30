import { describe, it, expect, beforeEach } from 'vitest';
import {
  stackSignature,
  canStack,
  addToInventory,
  stackAll,
  hasStackablePeers,
} from './inventory-stacking.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from './components.js';

describe('inventory stacking', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  function makeArrows(count, maxStackSize = 100) {
    const e = registry.createEntity();
    registry.addComponent(e, 'name', components.name('Arrow'));
    registry.addComponent(e, 'ammunition', components.ammunition('arrow', 0.5, { N: 'arrow-n' }));
    registry.addComponent(e, 'item', components.item({ type: 'inventory', ownerId: 99 }));
    registry.addComponent(e, 'stackable', components.stackable(maxStackSize, count));
    return e;
  }

  function makePotion() {
    const e = registry.createEntity();
    registry.addComponent(e, 'name', components.name('Healing Potion'));
    registry.addComponent(e, 'item', components.item({ type: 'inventory', ownerId: 99 }));
    return e;
  }

  const inv = (...items) => ({ items });

  describe('stackSignature', () => {
    it('is null for a non-stackable item', () => {
      expect(stackSignature(makePotion())).toBe(null);
    });

    it('matches for two stacks of the same item regardless of count or location', () => {
      const a = makeArrows(5);
      const b = makeArrows(20);
      b.components.get('item').location = { type: 'map' };
      expect(stackSignature(a)).toBe(stackSignature(b));
    });

    it('differs when a non-volatile component differs', () => {
      const a = makeArrows(5);
      const b = makeArrows(5);
      b.components.get('ammunition').breakChance = 0.9;
      expect(stackSignature(a)).not.toBe(stackSignature(b));
    });

    it('differs when the max stack size differs', () => {
      expect(stackSignature(makeArrows(5, 100))).not.toBe(stackSignature(makeArrows(5, 50)));
    });
  });

  describe('canStack', () => {
    it('is true for two like stacks and false for unlike or non-stackable', () => {
      expect(canStack(makeArrows(5), makeArrows(1))).toBe(true);
      expect(canStack(makeArrows(5), makePotion())).toBe(false);
      expect(canStack(makePotion(), makePotion())).toBe(false);
    });
  });

  describe('addToInventory', () => {
    it('pushes a non-stackable item as its own entry', () => {
      const inventory = inv();
      const potion = makePotion();
      expect(addToInventory(inventory, potion, registry)).toBe(potion);
      expect(inventory.items).toEqual([potion]);
    });

    it('pushes a new stack when no like stack exists', () => {
      const inventory = inv();
      const arrows = makeArrows(20);
      expect(addToInventory(inventory, arrows, registry)).toBe(arrows);
      expect(inventory.items).toEqual([arrows]);
    });

    it('pours fully into an existing partial stack and destroys the incoming entity', () => {
      const existing = makeArrows(80);
      const inventory = inv(existing);
      const incoming = makeArrows(15);

      expect(addToInventory(inventory, incoming, registry)).toBe(null);
      expect(existing.components.get('stackable').count).toBe(95);
      expect(inventory.items).toEqual([existing]);
      expect(registry.getEntity(incoming.id)).toBe(null);
    });

    it('fills the existing stack to max and keeps the spilled remainder as a new stack', () => {
      const existing = makeArrows(90);
      const inventory = inv(existing);
      const incoming = makeArrows(20);

      expect(addToInventory(inventory, incoming, registry)).toBe(incoming);
      expect(existing.components.get('stackable').count).toBe(100);
      expect(incoming.components.get('stackable').count).toBe(10);
      expect(inventory.items).toEqual([existing, incoming]);
    });

    it('spreads across multiple partial stacks before spilling', () => {
      const a = makeArrows(95);
      const b = makeArrows(90);
      const inventory = inv(a, b);
      const incoming = makeArrows(20);

      expect(addToInventory(inventory, incoming, registry)).toBe(incoming);
      expect(a.components.get('stackable').count).toBe(100);
      expect(b.components.get('stackable').count).toBe(100);
      expect(incoming.components.get('stackable').count).toBe(5);
    });

    it('does not pour into a full stack', () => {
      const full = makeArrows(100);
      const inventory = inv(full);
      const incoming = makeArrows(10);

      expect(addToInventory(inventory, incoming, registry)).toBe(incoming);
      expect(full.components.get('stackable').count).toBe(100);
      expect(incoming.components.get('stackable').count).toBe(10);
    });
  });

  describe('hasStackablePeers', () => {
    it('is true only when two or more below-max stacks of the item share a type', () => {
      const a = makeArrows(10);
      const b = makeArrows(10);
      expect(hasStackablePeers([a, b], a)).toBe(true);
    });

    it('is false with a single stack', () => {
      const a = makeArrows(10);
      expect(hasStackablePeers([a], a)).toBe(false);
    });

    it('is false when only one stack is below max (the rest are full)', () => {
      const full = makeArrows(100);
      const partial = makeArrows(10);
      expect(hasStackablePeers([full, partial], partial)).toBe(false);
    });

    it('is false for a non-stackable item', () => {
      const potion = makePotion();
      expect(hasStackablePeers([potion, makePotion()], potion)).toBe(false);
    });
  });

  describe('stackAll', () => {
    it('consolidates several partial stacks, removing emptied ones', () => {
      const a = makeArrows(40);
      const b = makeArrows(30);
      const c = makeArrows(20);
      const inventory = inv(a, b, c);

      stackAll(inventory, a, registry);

      // 90 total fits in one stack of 100.
      const counts = inventory.items.map((it) => it.components.get('stackable').count);
      expect(counts).toEqual([90]);
      expect(registry.getEntity(b.id)).toBe(null);
      expect(registry.getEntity(c.id)).toBe(null);
    });

    it('leaves a full stack plus a remainder when the total exceeds one max', () => {
      const inventory = inv(makeArrows(80), makeArrows(70), makeArrows(60));

      stackAll(inventory, inventory.items[0], registry);

      const counts = inventory.items
        .map((it) => it.components.get('stackable').count)
        .sort((x, y) => y - x);
      expect(counts).toEqual([100, 100, 10]);
    });

    it('only touches stacks matching the tapped item type', () => {
      const arrowsA = makeArrows(10);
      const arrowsB = makeArrows(10);
      const potion = makePotion();
      const inventory = inv(arrowsA, potion, arrowsB);

      stackAll(inventory, arrowsA, registry);

      expect(inventory.items).toContain(potion);
      const arrowStacks = inventory.items.filter((it) => it.components.has('stackable'));
      expect(arrowStacks.map((it) => it.components.get('stackable').count)).toEqual([20]);
    });
  });
});
