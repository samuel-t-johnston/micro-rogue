/**
 * Creates a registry that owns all entities and maintains a reverse index for
 * fast component-based queries. Each entity is `{ id, components: Map }`.
 */
export function createEntityRegistry() {
  let nextId = 1;
  const entities = new Map(); // id -> entity
  const componentIndex = new Map(); // componentName -> Set<id>

  function createEntity() {
    const entity = { id: nextId++, components: new Map() };
    entities.set(entity.id, entity);
    return entity;
  }

  function addComponent(entity, name, data) {
    entity.components.set(name, data);
    if (!componentIndex.has(name)) componentIndex.set(name, new Set());
    componentIndex.get(name).add(entity.id);
  }

  function removeComponent(entity, name) {
    entity.components.delete(name);
    componentIndex.get(name)?.delete(entity.id);
  }

  function getComponent(entity, name) {
    return entity.components.get(name) ?? null;
  }

  function hasComponent(entity, name) {
    return entity.components.has(name);
  }

  function getEntity(id) {
    return entities.get(id) ?? null;
  }

  function getEntitiesWith(name) {
    const ids = componentIndex.get(name);
    if (!ids) return [];
    return [...ids].map((id) => entities.get(id)).filter(Boolean);
  }

  function getAllEntities() {
    return [...entities.values()];
  }

  // Registers an empty entity shell under a specific id — used when rehydrating a save,
  // where ids must be preserved so cross-entity references resolve. Advances nextId past
  // the restored id so later createEntity() calls never collide with a loaded entity.
  function createEntityWithId(id) {
    const entity = { id, components: new Map() };
    entities.set(id, entity);
    if (id >= nextId) nextId = id + 1;
    return entity;
  }

  function getNextId() {
    return nextId;
  }

  // Restores the id counter on load. Stored explicitly (rather than derived from max id)
  // so ids freed by destroyed entities are never handed out a second time.
  function setNextId(n) {
    nextId = n;
  }

  function destroyEntity(entity) {
    for (const name of entity.components.keys()) {
      componentIndex.get(name)?.delete(entity.id);
    }
    entity.components.clear();
    entities.delete(entity.id);
  }

  return {
    createEntity,
    addComponent,
    removeComponent,
    getComponent,
    hasComponent,
    getEntity,
    getEntitiesWith,
    getAllEntities,
    createEntityWithId,
    getNextId,
    setNextId,
    destroyEntity,
  };
}
