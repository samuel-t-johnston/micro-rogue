/**
 * @file The dungeon runtime: owns which floor is active, the cold-storage of the floors that aren't,
 * and the travel operation that moves the player between them. It is the consumer side of the transit
 * map (data/transit-map.js) — it never decides topology, it executes it.
 *
 * Model (b): only the active floor's entities live in the registry. travel() freezes the floor being
 * left (serializing its entities out and removing them), then generates or thaws the destination, so
 * the registry-global turn manager and senses always see exactly one floor + the player.
 * See docs/design/map-generation.md and docs/design/dungeon-planner.md.
 */
import { rng } from '../../engine/core/rng.js';
import { runPipeline } from '../generation/pipeline.js';
import { collectSubgraph } from './subgraph.js';
import { freezeLevel, thawLevel } from './cold-storage.js';
import { getPipeline } from './pipelines.js';
import { getStart, getNode, resolveDestination } from './transit-map.js';
import { resolveArrival } from '../map/spawn.js';

/** Creates the dungeon runtime (see the file overview): start/travel/restore/snapshot over floors. */
export function createLevelManager({ registry, transitMap }) {
  const coldStorage = new Map(); // nodeId -> frozen blob (the inactive floors)
  let current = null; // { nodeId, level }

  // Generates a floor from its transit-map node, drawing from the per-level mapgen stream derived
  // from the node's identity so the floor is the same every time the seed is.
  async function generate(node) {
    const mapgenRng = rng.deriveRng('mapgen', node.branch, node.depth);
    return runPipeline(getPipeline(node.pipelineId), mapgenRng, registry, {
      identity: { branch: node.branch, depth: node.depth },
    });
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
    // the port leads nowhere (top/bottom of the dungeon).
    async travel(player, port) {
      const dest = resolveDestination(transitMap, current.nodeId, port);
      if (!dest) return null;

      // The player's whole sub-graph (carried + equipped items) travels with them, never frozen.
      const excludeIds = new Set([...collectSubgraph([player])].map((e) => e.id));
      const frozen = freezeLevel(registry, current.level, excludeIds);
      frozen.playerMemory = extractPlayerMemory(player); // fog of war rides into the frozen record
      coldStorage.set(current.nodeId, frozen);

      let level;
      if (coldStorage.has(dest.node)) {
        const blob = coldStorage.get(dest.node);
        level = thawLevel(blob, registry);
        applyPlayerMemory(player, blob.playerMemory); // restore the floor's remembered tiles
        coldStorage.delete(dest.node); // active again, no longer frozen
      } else {
        level = await generate(getNode(transitMap, dest.node));
        applyPlayerMemory(player, null); // never visited — start dark
      }

      arrive(player, level, dest.port);
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
