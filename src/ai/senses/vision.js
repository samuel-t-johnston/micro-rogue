import { computeFov } from '../../engine/fov.js';
import { getTileType } from '../../world/tile-registry.js';

export function createVisionSense() {
  return function vision(entity, level, turnCount) {
    const pos = entity.components.get('position');
    // Acuity from the `vision` component; an undefined range means unlimited sight (computeFov
    // treats undefined as no limit), preserving the behavior of creatures with no vision component.
    const range = entity.components.get('vision')?.range;

    const visibleTiles = computeFov(pos.x, pos.y, range, (x, y) => {
      const tileId = level.getTile(x, y);
      if (tileId === null) return true;
      if (getTileType(tileId).opaque) return true;
      for (const e of level.getEntitiesAt(x, y)) {
        if (e.components.has('opaque')) return true;
      }
      return false;
    });

    const entities = [];
    for (const e of level.entities) {
      if (e === entity) continue;
      const ePos = e.components.get('position');
      if (!ePos) continue;
      if (!visibleTiles.has(`${ePos.x},${ePos.y}`)) continue;
      entities.push({
        entityId: e.id,
        position: { x: ePos.x, y: ePos.y },
        confidence: 100,
        turnObserved: turnCount,
        factions: e.components.get('faction') ?? [],
        tags: {
          isPlayer: e.components.has('playerControlled'),
          // An actor (creature) vs. inert scenery/items — lets goals ignore floor items.
          // Hostility is decided by all goals via the faction list above (see areHostile).
          isActor: e.components.has('creature'),
        },
      });
    }

    return { entities, visibleTiles };
  };
}
