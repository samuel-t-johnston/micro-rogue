import { computeFov } from '../../engine/fov.js';
import { getTileType } from '../../world/tile-registry.js';

export function createVisionSense({ range } = {}) {
  return function vision(entity, level, turnCount) {
    const pos = entity.components.get('position');

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
        tags: {
          // Any active NPC is treated as hostile until a faction/relationship system exists.
          isEnemy: e.components.has('turnTaker') && !e.components.has('playerControlled'),
          isPlayer: e.components.has('playerControlled'),
        },
      });
    }

    return { entities, visibleTiles };
  };
}
