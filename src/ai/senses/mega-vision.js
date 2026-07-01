import { describeObservedEntity } from './observation-utils.js';

/**
 * Sense that reveals the full world state — all entities and their positions. Confidence is always
 * 100; no FOV or light gating. visibleTiles is empty because mega-vision bypasses tile-level
 * perception entirely.
 */
export function megaVision(entity, level, turnCount) {
  const entities = [];
  for (const e of level.entities) {
    if (e === entity) continue;
    const pos = e.components.get('position');
    if (!pos) continue;
    entities.push(describeObservedEntity(e, pos, turnCount));
  }
  return { entities, visibleTiles: new Set() };
}
