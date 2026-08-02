/**
 * @file The dungeon runtime: owns which floor is active, the cold-storage of the floors that aren't,
 * and the travel operation that moves the player between them. It is the consumer side of the transit
 * map (data/transit-map.js) — it never decides topology, it executes it.
 *
 * Only the active floor's entities live in the registry. travel() freezes the floor being
 * left (serializing its entities out and removing them), then generates or thaws the destination, so
 * the registry-global turn manager and senses always see exactly one floor + the player.
 * See docs/design/map-generation.md and docs/design/dungeon-planner.md.
 */
import { rng } from '../../engine/core/rng.js';
import { runPipeline } from '../generation/pipeline.js';
import { collectSubgraph } from './subgraph.js';
import { freezeLevel } from './cold-storage.js';
import { getReentryPolicy } from './reentry.js';
import { getPipeline } from './pipelines.js';
import { getStart, getNode, resolveDestination } from './transit-map-util.js';
import { resolveArrival } from '../map/spawn.js';
import { placeItemOnMap } from '../entities/placement.js';

/**
 * Creates the dungeon runtime (see the file overview): start/travel/restore/snapshot over floors.
 * `generateLevel(node, epoch)` is an optional seam that overrides how a floor is built — the default
 * runs the node's pipeline on its derived mapgen stream (folding in `epoch` for a re-entry regen).
 * Tests inject a trivial floor builder so the runtime's travel/freeze/thaw/regen logic can be
 * exercised without depending on any shipped content pipeline.
 */
export function createLevelManager({ registry, transitMap, generateLevel } = {}) {
  const coldStorage = new Map(); // nodeId -> frozen blob (the inactive floors)
  let current = null; // { nodeId, level }

  // Generates a floor from its transit-map node, drawing from the per-level mapgen stream derived
  // from the node's identity so the floor is the same every time the seed is. `epoch` is the re-entry
  // regeneration count: 0 (the original build) keeps the no-arg derivation so existing seeds and first
  // visits are byte-identical; a regen (epoch ≥ 1) folds the epoch in for a different-but-reproducible
  // layout. The built level carries the epoch it was made at, so the next regen increments from it.
  // See docs/design/reentry-pipelines.md and docs/design/rng-and-determinism.md.
  async function generate(node, epoch = 0) {
    const level = generateLevel
      ? await generateLevel(node, epoch)
      : await runPipeline(
          getPipeline(node.pipelineId),
          epoch === 0
            ? rng.deriveRng('mapgen', node.branch, node.depth)
            : rng.deriveRng('mapgen', node.branch, node.depth, epoch),
          registry,
          { identity: { branch: node.branch, depth: node.depth } },
        );
    level.epoch = epoch;
    return level;
  }

  // Places the player (and, by reference, its carried items) onto `level` at the arrival port.
  function arrive(player, level, port) {
    const { x, y } = resolveArrival(registry, level, port);
    const pos = player.components.get('position');
    pos.x = x;
    pos.y = y;
    level.placeEntity(player);
  }

  // Fog-of-war memory keyed by tile coords belongs to a floor, but it rides on the player's
  // tilePerception (the player isn't frozen). So we lift it into the floor's frozen record on the way
  // out and lay it back down on the way in — cold-storage stays player-agnostic; the player coupling
  // lives only here, the layer that already carries the player between floors. Stored JSON-safe
  // (arrays/entries) like the rest of the blob. `visible` is recomputed on arrival, so it isn't kept.
  function extractPlayerMemory(player) {
    const tp = player.components.get('tilePerception');
    if (!tp) return null;
    return { memory: [...tp.memory], rememberedEntities: [...tp.rememberedEntities] };
  }

  // Lays a floor's remembered tiles back onto the player (empty for a never-visited floor).
  function applyPlayerMemory(player, playerMemory) {
    const tp = player.components.get('tilePerception');
    if (!tp) return;
    tp.memory = new Map(playerMemory?.memory ?? []);
    tp.rememberedEntities = new Map(playerMemory?.rememberedEntities ?? []);
  }

  return {
    // Generates the dungeon's entry floor and makes it active. Returns the level plus the port the
    // player should arrive at (the caller creates the player and places it).
    async start() {
      const { node: startNodeId, port } = getStart(transitMap);
      const level = await generate(getNode(transitMap, startNodeId));
      current = { nodeId: startNodeId, level };
      return { level, arrivalPort: port };
    },

    // Moves the player through the transition at `port`: freezes the current floor, generates or
    // thaws the destination, and lands the player on it. Returns the new active level, or null if
    // the port leads nowhere (top/bottom of the dungeon). `currentTurn` is stamped onto the frozen
    // floor as `frozenAtTurn` so a future re-entry stage can compute how long the player was away
    // (see docs/design/reentry-pipelines.md); it is write-only for now.
    async travel(player, port, currentTurn = 0) {
      const dest = resolveDestination(transitMap, current.nodeId, port);
      if (!dest) return null;

      // The player's whole sub-graph (carried + equipped items) travels with them, never frozen.
      const excludeIds = new Set([...collectSubgraph([player])].map((e) => e.id));
      const frozen = freezeLevel(registry, current.level, excludeIds);
      frozen.playerMemory = extractPlayerMemory(player); // fog of war rides into the frozen record
      frozen.frozenAtTurn = currentTurn; // turn the floor was frozen at, for elapsed-time re-entry
      coldStorage.set(current.nodeId, frozen);

      let level;
      let carriedOver = [];
      if (coldStorage.has(dest.node)) {
        // A revisited floor: its node's re-entry policy turns the frozen blob into the live level to
        // arrive on — `thaw` (default) restores it as frozen, `regen` rebuilds it. The policy also
        // yields the fog-of-war to lay back down (frozen memory for a restored layout, null for a
        // freshly regenerated one) and any entities to re-place on the arrival tile. See reentry.js.
        const node = getNode(transitMap, dest.node);
        const blob = coldStorage.get(dest.node);
        const result = await getReentryPolicy(node.reentry)(blob, node, { registry, generate });
        level = result.level;
        carriedOver = result.carriedOver ?? [];
        applyPlayerMemory(player, result.playerMemory);
        coldStorage.delete(dest.node); // active again, no longer frozen
      } else {
        level = await generate(getNode(transitMap, dest.node));
        applyPlayerMemory(player, null); // never visited — start dark
      }

      arrive(player, level, dest.port);

      // Quest items a regen preserved land on the player's arrival tile — the soft-lock guard from
      // reentry.js (a dropped Amulet of Yendor mustn't be destroyed by a total reset). They settle
      // exactly like a dropped item so pickup works normally.
      if (carriedOver.length) {
        const { x, y } = player.components.get('position');
        for (const item of carriedOver) placeItemOnMap(registry, level, item, x, y);
      }

      current = { nodeId: dest.node, level };
      return level;
    },

    // Rehydrates the runtime from a loaded save: the active level (already deserialized) plus the
    // frozen floors. See src/save/core/save-system.js.
    restore({ currentNodeId, level, frozenLevels }) {
      current = { nodeId: currentNodeId, level };
      coldStorage.clear();
      for (const [nodeId, blob] of Object.entries(frozenLevels ?? {})) {
        coldStorage.set(nodeId, blob);
      }
    },

    // The save-facing snapshot of cross-floor state: the active floor's node id and the frozen
    // floors (already-serialized blobs, written as-is).
    snapshot() {
      const frozenLevels = {};
      for (const [nodeId, blob] of coldStorage) frozenLevels[nodeId] = blob;
      return { currentNodeId: current.nodeId, frozenLevels };
    },

    getCurrentLevel() {
      return current?.level ?? null;
    },
    getCurrentNodeId() {
      return current?.nodeId ?? null;
    },
  };
}
