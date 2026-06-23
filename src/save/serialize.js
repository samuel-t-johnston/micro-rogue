/**
 * @file Entity/level (de)serialization for the save system.
 *
 * The save format is a flat list of all registry entities, each cross-referencing others
 * (and the level referencing its members) purely by integer id. Almost every component is
 * already plain JSON — the codebase stores goals/senses/effects as string keys and never
 * holds function references. Only three component shapes can't go straight to JSON, and
 * each gets a codec below:
 *   - inventory:      `items` holds live entity refs        -> ids
 *   - wearsEquipment: `slots[slot]` holds an entity ref|null -> id|null
 *   - tilePerception: `visible` Set, `memory`/`rememberedEntities` Maps -> array / entries
 *
 * Keeping these as runtime types (refs, Set, Map) is the right call for gameplay hot paths;
 * the conversion lives here at the boundary rather than leaking into the gameplay systems.
 */
import { createLevel } from '../world/level.js';
import { serializeScent, deserializeScent } from '../world/scent.js';

// Each codec: serialize(data) -> JSON-safe; deserialize(data, getEntity) -> runtime shape.
// getEntity(id) resolves an id back to its (already-created) entity during load.
const COMPONENT_CODECS = {
  inventory: {
    serialize: (data) => ({ items: data.items.map((e) => e.id) }),
    deserialize: (data, getEntity) => ({ items: data.items.map((id) => getEntity(id)) }),
  },
  wearsEquipment: {
    serialize: (data) => {
      const slots = {};
      for (const [slot, ref] of Object.entries(data.slots)) {
        slots[slot] = ref ? ref.id : null;
      }
      return { slots };
    },
    deserialize: (data, getEntity) => {
      const slots = {};
      for (const [slot, id] of Object.entries(data.slots)) {
        slots[slot] = id == null ? null : getEntity(id);
      }
      return { slots };
    },
  },
  tilePerception: {
    serialize: (data) => ({
      visible: [...data.visible],
      memory: [...data.memory],
      rememberedEntities: [...data.rememberedEntities],
    }),
    deserialize: (data) => ({
      visible: new Set(data.visible),
      memory: new Map(data.memory),
      // `?? []` keeps pre-feature saves (no rememberedEntities) loading cleanly — no migration needed.
      rememberedEntities: new Map(data.rememberedEntities ?? []),
    }),
  },
};

// Components with no codec are plain JSON; clone so the save object never aliases live state.
function serializeComponent(name, data) {
  const codec = COMPONENT_CODECS[name];
  return codec ? codec.serialize(data) : structuredClone(data);
}

function deserializeComponent(name, data, getEntity) {
  const codec = COMPONENT_CODECS[name];
  return codec ? codec.deserialize(data, getEntity) : structuredClone(data);
}

/** Serializes one entity to `{ id, components }`, applying a component codec where one exists. */
export function serializeEntity(entity) {
  const components = {};
  for (const [name, data] of entity.components) {
    components[name] = serializeComponent(name, data);
  }
  return { id: entity.id, components };
}

/** Serializes every entity in the registry to a flat array. */
export function serializeEntities(registry) {
  return registry.getAllEntities().map(serializeEntity);
}

/**
 * Rehydrates entities into `registry` in two passes so the object graph resolves cleanly: pass 1
 * creates every shell (so all ids exist), pass 2 populates components and resolves id references
 * against the now-complete registry.
 */
export function deserializeEntities(serialized, registry) {
  for (const { id } of serialized) {
    registry.createEntityWithId(id);
  }
  const getEntity = (id) => registry.getEntity(id);
  for (const { id, components } of serialized) {
    const entity = registry.getEntity(id);
    for (const [name, data] of Object.entries(components)) {
      registry.addComponent(entity, name, deserializeComponent(name, data, getEntity));
    }
  }
}

/** Serializes a level's structure (tiles, overrides, blackboard, scent) plus its member entity ids. */
export function serializeLevel(level) {
  return {
    branch: level.branch,
    depth: level.depth,
    pipelineId: level.pipelineId,
    seed: level.seed,
    width: level.width,
    height: level.height,
    tiles: level.tiles.map((row) => [...row]),
    overrides: [...level.overrides],
    blackboard: structuredClone(level.blackboard),
    scent: serializeScent(level),
    entityIds: level.entities.map((e) => e.id),
  };
}

/**
 * Rebuilds a level and re-places its member entities (which must already exist in `registry`).
 * placeEntity() rebuilds the spatial index from each entity's position, so it is never serialized.
 */
export function deserializeLevel(data, registry) {
  const level = createLevel({
    branch: data.branch ?? null,
    depth: data.depth ?? null,
    pipelineId: data.pipelineId ?? null,
    seed: data.seed ?? null,
  });
  level.width = data.width;
  level.height = data.height;
  level.tiles = data.tiles.map((row) => [...row]);
  level.overrides = new Map(data.overrides);
  level.blackboard = structuredClone(data.blackboard);
  level.scent = deserializeScent(data.scent, data.width, data.height);
  for (const id of data.entityIds) {
    const entity = registry.getEntity(id);
    if (entity) level.placeEntity(entity);
  }
  return level;
}
