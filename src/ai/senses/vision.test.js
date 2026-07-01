import { describe, it, expect } from 'vitest';
import { createVisionSense } from './vision.js';
import { createLevel } from '../../world/map/level.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../../world/entities/components.js';

const vision = createVisionSense();

function setup(visionRange) {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.width = 21;
  level.height = 21;
  level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(10, 10));
  if (visionRange !== undefined) registry.addComponent(e, 'vision', components.vision(visionRange));
  level.placeEntity(e);
  return { level, e };
}

describe('vision acuity (range from the vision component)', () => {
  it('limits FOV to the component range', () => {
    const { level, e } = setup(3);
    const { visibleTiles } = vision(e, level, 0);
    expect(visibleTiles.has('13,10')).toBe(true); // 3 tiles east — within range 3
    expect(visibleTiles.has('14,10')).toBe(false); // 4 tiles east — beyond range 3
  });

  it('sees unlimited (open space) when there is no vision component', () => {
    const { level, e } = setup(undefined);
    const { visibleTiles } = vision(e, level, 0);
    expect(visibleTiles.has('20,10')).toBe(true); // far edge still visible
  });
});

describe('vision entity reporting', () => {
  function addEntity(level, registry, x, y, extra = {}) {
    const e = registry.createEntity();
    registry.addComponent(e, 'position', components.position(x, y));
    if (extra.faction) registry.addComponent(e, 'faction', components.faction(extra.faction));
    if (extra.player) registry.addComponent(e, 'playerControlled', components.playerControlled());
    if (extra.creature) registry.addComponent(e, 'creature', components.creature());
    if (extra.opaque) registry.addComponent(e, 'opaque', components.opaque());
    if (extra.openable) {
      const openable = components.openable('door-closed', 'door-open');
      openable.isOpen = extra.open ?? false;
      registry.addComponent(e, 'openable', openable);
    }
    level.placeEntity(e);
    return e;
  }

  it('reports a visible entity at full confidence with player/actor tags and factions', () => {
    const registry = createEntityRegistry();
    const level = createLevel();
    level.width = 21;
    level.height = 21;
    level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
    const seer = registry.createEntity();
    registry.addComponent(seer, 'position', components.position(10, 10));
    level.placeEntity(seer);

    const other = addEntity(level, registry, 12, 10, { faction: ['goblins'], creature: true });
    const { entities } = vision(seer, level, 7);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      entityId: other.id,
      position: { x: 12, y: 10 },
      confidence: 100,
      turnObserved: 7,
      factions: ['goblins'],
      tags: { isPlayer: false, isActor: true },
    });
  });

  it('reports an openable door with its open/closed state', () => {
    const registry = createEntityRegistry();
    const level = createLevel();
    level.width = 21;
    level.height = 21;
    level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
    const seer = registry.createEntity();
    registry.addComponent(seer, 'position', components.position(10, 10));
    level.placeEntity(seer);

    addEntity(level, registry, 11, 10, { openable: true, open: false }); // closed door
    addEntity(level, registry, 9, 10, { openable: true, open: true }); // open door
    const byId = new Map(
      vision(seer, level, 0).entities.map((o) => [`${o.position.x},${o.position.y}`, o]),
    );

    expect(byId.get('11,10')).toMatchObject({
      tags: { isOpenable: true, isActor: false },
      isOpen: false,
    });
    expect(byId.get('9,10')).toMatchObject({ tags: { isOpenable: true }, isOpen: true });
  });

  it('reports a non-openable entity with isOpenable false and no isOpen', () => {
    const registry = createEntityRegistry();
    const level = createLevel();
    level.width = 21;
    level.height = 21;
    level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
    const seer = registry.createEntity();
    registry.addComponent(seer, 'position', components.position(10, 10));
    level.placeEntity(seer);

    addEntity(level, registry, 11, 10, { creature: true });
    const [obs] = vision(seer, level, 0).entities;
    expect(obs.tags.isOpenable).toBe(false);
    expect(obs.isOpen).toBeUndefined();
  });

  it('tags a player-controlled entity as the player', () => {
    const registry = createEntityRegistry();
    const level = createLevel();
    level.width = 21;
    level.height = 21;
    level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
    const seer = registry.createEntity();
    registry.addComponent(seer, 'position', components.position(10, 10));
    level.placeEntity(seer);

    addEntity(level, registry, 11, 10, { player: true, creature: true });
    const { entities } = vision(seer, level, 0);
    expect(entities[0].tags).toEqual({ isPlayer: true, isActor: true, isOpenable: false });
    expect(entities[0].factions).toEqual([]); // no faction component -> empty
  });

  it('does not report itself, positionless entities, or entities on hidden tiles', () => {
    const registry = createEntityRegistry();
    const level = createLevel();
    level.width = 21;
    level.height = 21;
    level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
    const seer = registry.createEntity();
    registry.addComponent(seer, 'position', components.position(10, 10));
    registry.addComponent(seer, 'vision', components.vision(2));
    level.placeEntity(seer);

    // positionless entity (e.g. an item held in inventory) — never on the map, must be skipped
    const ghost = registry.createEntity();
    level.entities.push(ghost);
    // far entity outside the seer's range -> on a hidden tile
    addEntity(level, registry, 18, 10, { creature: true });

    const { entities } = vision(seer, level, 0);
    expect(entities).toHaveLength(0);
  });

  it('an opaque entity blocks line of sight to tiles and entities behind it', () => {
    const registry = createEntityRegistry();
    const level = createLevel();
    level.width = 21;
    level.height = 21;
    level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
    const seer = registry.createEntity();
    registry.addComponent(seer, 'position', components.position(10, 10));
    level.placeEntity(seer);

    addEntity(level, registry, 12, 10, { opaque: true }); // a wall-like blocker due east
    const behind = addEntity(level, registry, 14, 10, { creature: true }); // directly behind it

    const { entities, visibleTiles } = vision(seer, level, 0);
    expect(visibleTiles.has('14,10')).toBe(false); // tile behind the blocker is hidden
    expect(entities.some((r) => r.entityId === behind.id)).toBe(false);
  });
});
