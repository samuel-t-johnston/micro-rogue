/**
 * @file Pure lookups over a transit-map data object (see data/transit-map.js). The map is plain data
 * so the resolver, the dungeon runtime (level-manager.js), and any future visualizer all read it the
 * same way. An edge is `{ a: [node, port], b: [node, port], dir: 'bidi' | 'uni' }`; a 'uni' edge is
 * only traversable from `a` to `b` (e.g. a pit you fall down but can't climb back up).
 */

/** The level + port where a new game begins. */
export function getStart(map) {
  return map.start;
}

/** The node descriptor (`{ id, pipelineId, branch, depth }`) for an id, or null. */
export function getNode(map, nodeId) {
  return map.nodes.find((n) => n.id === nodeId) ?? null;
}

/**
 * Given the player is at `nodeId` and activates the transition at `port`, returns the destination
 * `{ node, port }` (where `port` is the arrival point on the destination), or null if that port is
 * not wired to anything (the top/bottom of the dungeon, or the wrong end of a one-way edge).
 */
export function resolveDestination(map, nodeId, port) {
  for (const edge of map.edges) {
    const [aNode, aPort] = edge.a;
    const [bNode, bPort] = edge.b;
    if (aNode === nodeId && aPort === port) {
      return { node: bNode, port: bPort };
    }
    if (edge.dir === 'bidi' && bNode === nodeId && bPort === port) {
      return { node: aNode, port: aPort };
    }
  }
  return null;
}
