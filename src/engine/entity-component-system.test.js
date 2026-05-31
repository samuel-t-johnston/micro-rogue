import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from './entity-component-system.js';

describe('createEntityRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  describe('createEntity', () => {
    it('returns an entity with a unique integer id', () => {
      const a = registry.createEntity();
      const b = registry.createEntity();
      expect(typeof a.id).toBe('number');
      expect(b.id).toBeGreaterThan(a.id);
    });

    it('returns an entity with an empty component map', () => {
      const entity = registry.createEntity();
      expect(entity.components.size).toBe(0);
    });
  });

  describe('addComponent', () => {
    it('attaches the component data to the entity', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'health', { max: 10, current: 10 });
      expect(entity.components.get('health')).toEqual({ max: 10, current: 10 });
    });

    it('includes the entity in the component index', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'health', { max: 10, current: 10 });
      expect(registry.getEntitiesWith('health')).toContain(entity);
    });
  });

  describe('removeComponent', () => {
    it('removes the component from the entity', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'health', { max: 10, current: 10 });
      registry.removeComponent(entity, 'health');
      expect(entity.components.has('health')).toBe(false);
    });

    it('removes the entity from the component index', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'health', { max: 10, current: 10 });
      registry.removeComponent(entity, 'health');
      expect(registry.getEntitiesWith('health')).not.toContain(entity);
    });

    it('is a no-op for components the entity does not have', () => {
      const entity = registry.createEntity();
      expect(() => registry.removeComponent(entity, 'health')).not.toThrow();
    });
  });

  describe('getComponent', () => {
    it('returns the component data', () => {
      const entity = registry.createEntity();
      const data = { x: 3, y: 4 };
      registry.addComponent(entity, 'position', data);
      expect(registry.getComponent(entity, 'position')).toBe(data);
    });

    it('returns null if the component is absent', () => {
      const entity = registry.createEntity();
      expect(registry.getComponent(entity, 'position')).toBeNull();
    });
  });

  describe('hasComponent', () => {
    it('returns true when the component is present', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'turnTaker', { speed: 1, accumulator: 0 });
      expect(registry.hasComponent(entity, 'turnTaker')).toBe(true);
    });

    it('returns false when the component is absent', () => {
      const entity = registry.createEntity();
      expect(registry.hasComponent(entity, 'turnTaker')).toBe(false);
    });
  });

  describe('getEntitiesWith', () => {
    it('returns all entities that have the given component', () => {
      const a = registry.createEntity();
      const b = registry.createEntity();
      const c = registry.createEntity();
      registry.addComponent(a, 'turnTaker', {});
      registry.addComponent(b, 'turnTaker', {});
      const result = registry.getEntitiesWith('turnTaker');
      expect(result).toContain(a);
      expect(result).toContain(b);
      expect(result).not.toContain(c);
    });

    it('returns an empty array if no entities have the component', () => {
      expect(registry.getEntitiesWith('health')).toEqual([]);
    });
  });

  describe('destroyEntity', () => {
    it('removes the entity from all component indexes', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'health', {});
      registry.addComponent(entity, 'position', {});
      registry.destroyEntity(entity);
      expect(registry.getEntitiesWith('health')).not.toContain(entity);
      expect(registry.getEntitiesWith('position')).not.toContain(entity);
    });

    it('clears the entity component map', () => {
      const entity = registry.createEntity();
      registry.addComponent(entity, 'health', {});
      registry.destroyEntity(entity);
      expect(entity.components.size).toBe(0);
    });
  });
});
