import { getTileType } from './tile-registry.js';

/**
 * Creates an empty level object (grid + spatial index + entity list) and its place/move/remove/query
 * methods. Identity (branch, depth, pipelineId, seed) is stamped by the pipeline at generation time
 * and carried for the dungeon coordinator + cold storage: `(branch, depth)` keys the level in the
 * transit map and the mapgen RNG; `seed` is the derived generation seed (kept so a frozen level can
 * be reconstructed even if the derivation function later changes). See
 * docs/design/rng-and-determinism.md and docs/design/map-generation.md.
 */
export function createLevel({ branch = null, depth = null, pipelineId = null, seed = null } = {}) {
  return {
    branch,
    depth,
    pipelineId,
    seed,
    width: 0,
    height: 0,
    tiles: [], // tiles[y][x] — tile type id string
    overrides: new Map(), // "x,y" -> tile type id string
    blackboard: {},
    entities: [], // all entities currently on this level
    spatialIndex: new Map(), // "x,y" -> Set<entity>

    getTile(x, y) {
      return this.overrides.get(`${x},${y}`) ?? this.tiles[y]?.[x] ?? null;
    },

    // Returns entities at the given tile coordinates.
    getEntitiesAt(x, y) {
      return this.spatialIndex.get(`${x},${y}`) ?? new Set();
    },

    // Places an entity onto this level. The entity must already have a position component.
    placeEntity(entity) {
      const pos = entity.components.get('position');
      if (!pos) throw new Error('placeEntity: entity has no position component');
      const key = `${pos.x},${pos.y}`;
      if (!this.spatialIndex.has(key)) this.spatialIndex.set(key, new Set());
      this.spatialIndex.get(key).add(entity);
      this.entities.push(entity);
    },

    // Moves an entity to a new tile, updating its position component and the spatial index.
    // Does not validate the move — callers must check passability before calling this.
    moveEntity(entity, x, y) {
      const pos = entity.components.get('position');
      if (pos) {
        this.spatialIndex.get(`${pos.x},${pos.y}`)?.delete(entity);
        pos.x = x;
        pos.y = y;
      }
      const key = `${x},${y}`;
      if (!this.spatialIndex.has(key)) this.spatialIndex.set(key, new Set());
      this.spatialIndex.get(key).add(entity);
    },

    // Removes an entity from the level's entity list and spatial index.
    removeEntity(entity) {
      const pos = entity.components.get('position');
      if (pos) this.spatialIndex.get(`${pos.x},${pos.y}`)?.delete(entity);
      const idx = this.entities.indexOf(entity);
      if (idx !== -1) this.entities.splice(idx, 1);
    },

    // Returns true if the tile at (x, y) is passable and has no blocking entities.
    isPassable(x, y) {
      const tileId = this.getTile(x, y);
      if (!tileId) return false;
      try {
        if (getTileType(tileId).blocksMovement) return false;
      } catch {
        console.warn(`isPassable: unregistered tile id "${tileId}" at (${x},${y})`);
        return false;
      }
      for (const entity of this.getEntitiesAt(x, y)) {
        if (entity.components.has('blocksMovement')) return false;
      }
      return true;
    },
  };
}
