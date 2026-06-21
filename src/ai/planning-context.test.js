import { describe, it, expect } from 'vitest';
import { applySenses, buildPlanningContext } from './planning-context.js';
import { registerSense } from './senses/sense-registry.js';
import { createLevel } from '../world/level.js';

function makeEntity(overrides = {}) {
  const defaults = {
    position: { x: 0, y: 0 },
    senses: [],
    tilePerception: { visible: new Set(), memory: new Map(), rememberedEntities: new Map() },
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

// Registers a mock sense under a unique name (the senses component holds names, not
// functions) and returns the name for use in an entity's `senses` component.
let senseSeq = 0;
function makeSense(visibleTiles, entities = []) {
  const name = `mock-sense-${senseSeq++}`;
  registerSense(name, () => ({ entities, visibleTiles }));
  return name;
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
    registerSense('mock-accumulates', () => ({ entities: [], visibleTiles }));
    const entity = makeEntity({ senses: ['mock-accumulates'] });
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
    registerSense('mock-replaced', () => ({ entities: [], visibleTiles }));
    const entity = makeEntity({ senses: ['mock-replaced'] });
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

describe('applySenses fog-of-war furniture', () => {
  // Places a furniture-like entity at (x,y) with a renderable and the given marker components.
  function placeFurniture(level, x, y, renderable, markers = ['persistVisible']) {
    const components = new Map([['position', { x, y }], ['renderable', renderable]]);
    for (const m of markers) components.set(m, {});
    const entity = { id: `f-${x}-${y}`, components };
    level.placeEntity(entity);
    return entity;
  }

  const doorRenderable = { sprite: { col: 16, row: 22 }, color: '#8B6F47', glyph: '+', glyphColor: '#c8a36a', layer: 0 };

  it('snapshots a persistVisible entity on a visible tile', () => {
    const level = makeLevel(5, 5);
    placeFurniture(level, 2, 3, doorRenderable);
    const entity = makeEntity({ senses: [makeSense(new Set(['2,3']))] });

    applySenses(entity, level);

    const snaps = entity.components.get('tilePerception').rememberedEntities.get('2,3');
    expect(snaps).toEqual([doorRenderable]);
  });

  it('does not snapshot entities lacking a rememberable component', () => {
    const level = makeLevel(5, 5);
    placeFurniture(level, 2, 3, doorRenderable, ['creature']); // an actor, not remembered
    const entity = makeEntity({ senses: [makeSense(new Set(['2,3']))] });

    applySenses(entity, level);

    expect(entity.components.get('tilePerception').rememberedEntities.has('2,3')).toBe(false);
  });

  it('retains the snapshot after the tile leaves view', () => {
    const level = makeLevel(5, 5);
    placeFurniture(level, 2, 3, doorRenderable);
    let visibleTiles = new Set(['2,3']);
    registerSense('mock-fov-retain', () => ({ entities: [], visibleTiles }));
    const entity = makeEntity({ senses: ['mock-fov-retain'] });

    applySenses(entity, level);
    visibleTiles = new Set(['0,0']); // walk away; tile 2,3 no longer visible
    applySenses(entity, level);

    expect(entity.components.get('tilePerception').rememberedEntities.get('2,3')).toEqual([doorRenderable]);
  });

  it('replaces the snapshot with the latest appearance when the tile is re-seen', () => {
    const level = makeLevel(5, 5);
    const door = placeFurniture(level, 2, 3, { ...doorRenderable });
    const entity = makeEntity({ senses: [makeSense(new Set(['2,3']))] });

    applySenses(entity, level);
    door.components.get('renderable').glyph = "'"; // door opened: appearance changes
    applySenses(entity, level);

    expect(entity.components.get('tilePerception').rememberedEntities.get('2,3')[0].glyph).toBe("'");
  });

  it('clears a remembered tile when its furniture is gone on re-sighting', () => {
    const level = makeLevel(5, 5);
    const door = placeFurniture(level, 2, 3, doorRenderable);
    const entity = makeEntity({ senses: [makeSense(new Set(['2,3']))] });

    applySenses(entity, level);
    level.removeEntity(door);
    applySenses(entity, level);

    expect(entity.components.get('tilePerception').rememberedEntities.has('2,3')).toBe(false);
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

  it('collects sounds from sense results into perception.sounds', () => {
    registerSense('mock-hears', () => ({
      entities: [], visibleTiles: new Set(), sounds: [{ soundId: 1, message: { kind: 'x' } }],
    }));
    const entity = makeEntity({ senses: ['mock-hears'] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.sounds).toEqual([{ soundId: 1, message: { kind: 'x' } }]);
  });

  it('dedupes a sound reported by more than one sense, by soundId', () => {
    registerSense('mock-hears-a', () => ({ entities: [], visibleTiles: new Set(), sounds: [{ soundId: 5 }] }));
    registerSense('mock-hears-b', () => ({ entities: [], visibleTiles: new Set(), sounds: [{ soundId: 5 }] }));
    const entity = makeEntity({ senses: ['mock-hears-a', 'mock-hears-b'] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.sounds).toHaveLength(1);
  });

  it('defaults perception.sounds to empty when no sense reports sounds', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['1,0']))] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.sounds).toEqual([]);
  });

  it('collects smells from sense results into perception.smells', () => {
    registerSense('mock-smells', () => ({
      entities: [], visibleTiles: new Set(), smells: [{ profile: 'orcs', intensity: 5 }],
    }));
    const entity = makeEntity({ senses: ['mock-smells'] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.smells).toEqual([{ profile: 'orcs', intensity: 5 }]);
  });

  it('keeps the strongest reading when two senses report the same scent profile', () => {
    registerSense('mock-smell-a', () => ({ entities: [], visibleTiles: new Set(), smells: [{ profile: 'orcs', intensity: 3 }] }));
    registerSense('mock-smell-b', () => ({ entities: [], visibleTiles: new Set(), smells: [{ profile: 'orcs', intensity: 9 }] }));
    const entity = makeEntity({ senses: ['mock-smell-a', 'mock-smell-b'] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.smells).toEqual([{ profile: 'orcs', intensity: 9 }]);
  });

  it('defaults perception.smells to empty when no sense reports smells', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(['1,0']))] });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 0 });
    expect(ctx.perception.smells).toEqual([]);
  });
});

describe('perception memory (lastKnownEnemy)', () => {
  const inputController = { waitForInput: () => {}, hasPendingInput: () => false };
  const enemy = { entityId: 9, position: { x: 3, y: 0 }, factions: ['player'], tags: { isActor: true } };

  it('records a seen hostile\'s exact tile when the entity remembers enemies', () => {
    const entity = makeEntity({
      senses: [makeSense(new Set(), [enemy])], faction: ['orcs'], memory: { remembersEnemies: true },
    });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 7 });
    expect(ctx.memory.lastKnownEnemy).toEqual({ pos: { x: 3, y: 0 }, turn: 7, source: 'sight' });
  });

  it('does not record when the entity does not remember enemies', () => {
    const entity = makeEntity({ senses: [makeSense(new Set(), [enemy])], faction: ['orcs'], memory: {} });
    const ctx = buildPlanningContext({ entity, level: makeLevel(5, 5), inputController, turnCount: 1 });
    expect(ctx.memory.lastKnownEnemy).toBeUndefined();
  });

  it('records a non-ally noise as a projected tile when nothing is seen', () => {
    registerSense('mock-enemy-noise', () => ({
      entities: [], visibleTiles: new Set(),
      sounds: [{ soundId: 1, perceivedDirection: 'E', distance: 3, sourceFactions: ['player'] }],
    }));
    const entity = makeEntity({ senses: ['mock-enemy-noise'], faction: ['orcs'], memory: { remembersEnemies: true } });
    const ctx = buildPlanningContext({ entity, level: makeLevel(10, 10), inputController, turnCount: 2 });
    expect(ctx.memory.lastKnownEnemy).toEqual({ pos: { x: 3, y: 0 }, turn: 2, source: 'hearing' });
  });

  it('ignores a noise from a confirmed ally', () => {
    registerSense('mock-ally-noise', () => ({
      entities: [], visibleTiles: new Set(),
      sounds: [{ soundId: 1, perceivedDirection: 'E', distance: 3, sourceFactions: ['orcs'] }],
    }));
    const entity = makeEntity({ senses: ['mock-ally-noise'], faction: ['orcs'], memory: { remembersEnemies: true } });
    const ctx = buildPlanningContext({ entity, level: makeLevel(10, 10), inputController, turnCount: 2 });
    expect(ctx.memory.lastKnownEnemy).toBeUndefined();
  });

  it('prefers a vision sighting over a heard noise', () => {
    registerSense('mock-see-and-hear', () => ({
      entities: [enemy], visibleTiles: new Set(),
      sounds: [{ soundId: 1, perceivedDirection: 'S', distance: 5, sourceFactions: ['player'] }],
    }));
    const entity = makeEntity({ senses: ['mock-see-and-hear'], faction: ['orcs'], memory: { remembersEnemies: true } });
    const ctx = buildPlanningContext({ entity, level: makeLevel(10, 10), inputController, turnCount: 3 });
    expect(ctx.memory.lastKnownEnemy.source).toBe('sight');
  });
});
