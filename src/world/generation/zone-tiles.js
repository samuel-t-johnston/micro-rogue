// Shared helpers for placing entities inside a zone's *rooms* — the carved room rectangles only
// (`level:rooms`), never the corridors, doors, or gutters that also sit inside a zone's cells. This
// is what keeps spawns out of hallways and off furniture. See docs/design/procedural-3x3-dungeon.md.

// All floor tiles inside a zone's room rectangle(s). Rect tiles are floor by construction, so no
// tile check is needed; merged zones may double-count their seam overlap, which is harmless.
export function roomTiles(zone, rooms) {
  const tiles = [];
  for (const [c, r] of zone.cells) {
    const rect = rooms[`${c},${r}`];
    if (!rect) continue;
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) tiles.push([x, y]);
    }
  }
  return tiles;
}

// The room tile nearest the zone's centre, or null if it has no room.
export function centermostRoomTile(zone, rooms) {
  const tiles = roomTiles(zone, rooms);
  if (tiles.length === 0) return null;
  const cx = zone.rect.x + zone.rect.w / 2;
  const cy = zone.rect.y + zone.rect.h / 2;
  let best = tiles[0];
  let bestD = Infinity;
  for (const [x, y] of tiles) {
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestD) { bestD = d; best = [x, y]; }
  }
  return best;
}
