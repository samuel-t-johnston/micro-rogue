/**
 * @file Shared helpers for placing entities inside a zone's *rooms* — the carved room floor
 * (`level:rooms`), never the corridors, doors, or gutters that also sit inside a zone's cells. This is
 * what keeps spawns out of hallways and off furniture. See docs/design/procedural-3x3-dungeon.md.
 *
 * A `level:rooms` entry is either a rectangle (`{x0,y0,x1,y1}`, from BSP/grid/static layouts) or an
 * irregular tile set (`{tiles:[[x,y]…]}`, from organic generators — see
 * docs/design/organic-map-generation.md). Either may also carry `core:[x,y]`, a strictly-interior
 * anchor. These helpers are the single seam that hides that difference from every population and
 * finishing stage, so they work over any geometry unchanged.
 */

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
