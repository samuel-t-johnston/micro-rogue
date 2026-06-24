/**
 * @file Cold storage: freezing the active level into a serialized blob and thawing it back. This is
 * the "model (b)" runtime — only the *active* level's entities ever live in the registry, so the
 * registry-global turn manager and sense systems never tick or see frozen floors. The complexity of
 * multi-floor state is absorbed here at the transition boundary instead of being pushed into every
 * system. See docs/design/map-generation.md ("Level Lifecycle and Cold Storage").
 */
import {
  serializeEntity,
  deserializeEntities,
  serializeLevel,
  deserializeLevel,
} from '../../save/core/serialize.js';
import { collectSubgraph } from './subgraph.js';

/**
 * Serializes `level` and its entities into a blob, then removes those entities from `registry`.
 * `excludeIds` is the sub-graph that travels with the player (the player + carried/equipped items);
 * it is left in the registry and kept out of the blob, so it is never frozen into the level being
 * left. The blob is a plain JSON-safe object: `{ level, entities }`, the same shapes the save uses.
 */
export function freezeLevel(registry, level, excludeIds = new Set()) {
  const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);

  // The level's full entity set = its on-map entities plus everything they contain/carry. Walking
  // from `level.entities` reaches the player's inventory too, so the exclude set is what keeps the
  // player's carried items from being dragged into the freeze.
  const reachable = collectSubgraph(level.entities);
  const frozen = [...reachable].filter((e) => !exclude.has(e.id));

  // Drop any excluded on-map entity (the player) from the level first, so the blob's `entityIds`
  // never references an entity the blob doesn't contain.
  for (const entity of [...level.entities]) {
    if (exclude.has(entity.id)) level.removeEntity(entity);
  }

  const blob = {
    level: serializeLevel(level),
    entities: frozen.map(serializeEntity),
  };

  // Model (b): the frozen entities leave the live registry entirely. nextId is never rewound, so
  // their ids stay reserved and a later thaw re-registers them without colliding with new entities.
  for (const entity of frozen) registry.destroyEntity(entity);

  return blob;
}

/**
 * Rehydrates a frozen blob back into `registry` and returns the live level. The player sub-graph is
 * not part of the blob — the caller places it onto the returned level at the arrival point.
 */
export function thawLevel(blob, registry) {
  deserializeEntities(blob.entities, registry);
  return deserializeLevel(blob.level, registry);
}
