/**
 * @file Shared zone helpers: listing the floor tiles inside a zone's *rooms* (`level:rooms`, never the
 * corridors/doors/gutters that also sit in a zone's cells — this keeps spawns out of hallways), the
 * chamber predicate, and the seam that merges a structure stage's zone graph into the blackboard so
 * multiple sections compose. See docs/design/procedural-3x3-dungeon.md and organic-map-generation.md.
 *
 * A `level:rooms` entry is either a rectangle (`{x0,y0,x1,y1}`, from BSP/grid/static layouts) or an
 * irregular tile set (`{tiles:[[x,y]…]}`, from organic generators). Either may also carry `core:[x,y]`,
 * a strictly-interior anchor. `roomTiles`/`centermostRoomTile` are the single seam that hides that
 * difference from every population and finishing stage, so they work over any geometry unchanged.
 */
import {
  LEVEL_ZONES,
  LEVEL_ROOMS,
  LEVEL_ADJACENCY,
  LEVEL_LINKS,
  LEVEL_CHOKEPOINTS,
} from './blackboard-keys.js';

/**
 * Merges one structure stage's zone graph into the blackboard, offsetting its ids by the running zone
 * count so multiple sections compose without colliding — a second section's zone 0 would otherwise
 * overwrite the first's. Ids are dense per stage, so the cumulative ids stay dense. Assumes the
 * one-cell `[[id,0]]` / `"id,0"` convention (BSP and the organic generators); the room-grid pipeline,
 * which keys rooms by grid cell and is never composed, writes the blackboard directly. `adjacency`,
 * `links`, and `chokepoints` are optional. Returns the id offset (base) applied — at base 0 this is
 * exactly the old direct-write behaviour.
 */
export function appendZones(
  blackboard,
  { zones = [], rooms = {}, adjacency, links, chokepoints } = {},
) {
  const existingZones = blackboard[LEVEL_ZONES] ?? [];
  const base = existingZones.reduce((m, z) => Math.max(m, z.id), -1) + 1;

  const mergedZones = existingZones.slice();
  const mergedRooms = { ...(blackboard[LEVEL_ROOMS] ?? {}) };
  for (const z of zones) {
    const id = z.id + base;
    mergedZones.push({ ...z, id, cells: [[id, 0]] });
    const room = rooms[`${z.id},0`];
    if (room) mergedRooms[`${id},0`] = room;
  }
  blackboard[LEVEL_ZONES] = mergedZones;
  blackboard[LEVEL_ROOMS] = mergedRooms;

  if (adjacency) {
    blackboard[LEVEL_ADJACENCY] = [
      ...(blackboard[LEVEL_ADJACENCY] ?? []),
      ...adjacency.map(([a, b]) => [a + base, b + base]),
    ];
  }
  if (links) {
    const existing = blackboard[LEVEL_LINKS] ?? [];
    blackboard[LEVEL_LINKS] = [
      ...existing,
      ...links.map((l, i) => ({ id: existing.length + i, a: l.a + base, b: l.b + base })),
    ];
  }
  if (chokepoints) {
    blackboard[LEVEL_CHOKEPOINTS] = [...(blackboard[LEVEL_CHOKEPOINTS] ?? []), ...chokepoints];
  }
  return base;
}

/**
 * Whether a zone is a chamber — an open space that takes labels, stairs, and population. A zone with
 * no `kind` is a chamber (BSP/grid/static rooms); `passage`/`junction` (CA connective tissue) are not.
 * The single definition of the "absent ⇒ chamber" rule, so no consumer re-derives it and drifts (a
 * bare `kind === 'chamber'` would wrongly exclude every non-organic room). See ADR-026.
 */
export const isChamber = (zone) => (zone.kind ?? 'chamber') === 'chamber';

/**
 * All floor tiles inside a zone's room(s). An explicit `tiles` list is used verbatim; otherwise the
 * rect is expanded (its interior is floor by construction). Merged zones may double-count a seam
 * overlap, which is harmless.
 */
export function roomTiles(zone, rooms) {
  const tiles = [];
  for (const [c, r] of zone.cells) {
    const room = rooms[`${c},${r}`];
    if (!room) continue;
    if (room.tiles) {
      tiles.push(...room.tiles);
      continue;
    }
    for (let y = room.y0; y <= room.y1; y++) {
      for (let x = room.x0; x <= room.x1; x++) tiles.push([x, y]);
    }
  }
  return tiles;
}

/**
 * A deep-interior tile of the zone, for anchoring stairs and the entry point, or null if it has no
 * room. An explicit `core` (a chamber's node centre, or segmentation's distance-transform peak) wins:
 * an irregular cavern's bounding-rect centroid can land on a wall or a neck. Absent a core, fall back
 * to the room tile nearest the zone's geometric centre.
 */
export function centermostRoomTile(zone, rooms) {
  for (const [c, r] of zone.cells) {
    const room = rooms[`${c},${r}`];
    if (room?.core) return room.core;
  }
  const tiles = roomTiles(zone, rooms);
  if (tiles.length === 0) return null;
  const cx = zone.rect.x + zone.rect.w / 2;
  const cy = zone.rect.y + zone.rect.h / 2;
  let best = tiles[0];
  let bestD = Infinity;
  for (const [x, y] of tiles) {
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = [x, y];
    }
  }
  return best;
}
