import { describe, it, expect } from 'vitest';
import { applySenses, buildPlanningContext } from './planning-context.js';
import { createLevel } from '../world/level.js';

function makeEntity(overrides = {}) {
  const defaults = {
    position: { x: 0, y: 0 },
    senses: [],
    tilePerception: { visible: new Set(), memory: new Map() },
    memory: {},
  };
  const merged = { ...defaults, ...overrides };
  return { id: 1, components: new Map(Object.entries(merged)) };
}

function makeLevel(w, h, tileId = 'floor') {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill(tileId));
  return level;
}

function makeSense(visibleTiles, entities = []) {
  return () => ({ entities, visibleTiles });
}

describe('applySenses', () => {
  it('sets tilePerception.visible to the union of all sense visibleTiles', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['1,0', '0,1']))] });
    applySenses(entity, makeLevel(5, 5));
    const { visible } = entity.components.get('tilePerception');
    expect(visible.has('1,0')).toBe(true);
    expect(visible.has('0,1')).toBe(true);
  });

  it('unions visible tiles from multiple senses', () => {
    const entity = makeEntity({
      senses: [makeSense(new Set(['1,0'])), makeSense(new Set(['0,1']))],
    });
    applySenses(entity, makeLevel(5, 5));
    const { visible } = entity.components.get('tilePerception');
    expect(visible.has('1,0')).toBe(true);
    expect(visible.has('0,1')).toBe(true);
  });

  it('populates tilePerception.memory with tileId for each visible tile', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['2,3']))] });
    applySenses(entity, makeLevel(5, 5));
    expect(entity.components.get('tilePerception').memory.get('2,3')).toBe('floor');
  });

  it('memory accumulates across multiple calls', () => {
    let visibleTiles = new Set(['1,0']);
    const sense = () => ({ entities: [], visibleTiles });
    const entity = makeEntity({ senses: [sense] });
    const level = makeLevel(5, 5);

    applySenses(entity, level);
    visibleTiles = new Set(['2,0']);
    applySenses(entity, level);

    const { memory } = entity.components.get('tilePerception');
    expect(memory.has('1,0')).toBe(true); // from first call
    expect(memory.has('2,0')).toBe(true); // from second call
  });

  it('visible is replaced each call, not accumulated', () => {
    let visibleTiles = new Set(['1,0']);
    const sense = () => ({ entities: [], visibleTiles });
    const entity = makeEntity({ senses: [sense] });
    const level = makeLevel(5, 5);

    applySenses(entity, level);
    visibleTiles = new Set(['2,0']);
    applySenses(entity, level);

    const { visible } = entity.components.get('tilePerception');
    expect(visible.has('1,0')).toBe(false);
    expect(visible.has('2,0')).toBe(true);
  });

  it('does not throw when entity has no tilePerception component', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['1,0']))] });
    entity.components.delete('tilePerception');
    expect(() => applySenses(entity, makeLevel(5, 5))).not.toThrow();
  });
});

describe('buildPlanningContext', () => {
  const inputController = { waitForInput: () => {}, hasPendingInput: () => false };

  it('merges entity observations from multiple senses, higher confidence wins', () => {
    const obs = (confidence) => ({
      entityId: 'e1', position: { x: 1, y: 0 }, confidence, turnObserved: 1, tags: {},
    });
    const entity = makeEntity({
      senses: [makeSense(new Set(), [obs(60)]), makeSense(new Set(), [obs(80)])],
    });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 1 });
    expect(ctx.perception.entities).toHaveLength(1);
    expect(ctx.perception.entities[0].confidence).toBe(80);
  });

  it('exposes visibleTiles as the current-turn visible Set', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['1,0']))] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.visibleTiles.has('1,0')).toBe(true);
  });

  it('exposes knownTiles as the tilePerception memory map', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['1,0']))] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.knownTiles).toBe(entity.components.get('tilePerception').memory);
    expect(ctx.perception.knownTiles.get('1,0')).toBe('floor');
  });
});
