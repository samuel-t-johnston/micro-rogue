// Shared helpers for placing entities inside a zone's carved room.

// All floor tiles within a zone's cells.
export function zoneFloorTiles(level, zone, cs) {
  const tiles = [];
  for (const [gc, gr] of zone.cells) {
    for (let y = gr * cs; y < gr * cs + cs; y++) {
      for (let x = gc * cs; x < gc * cs + cs; x++) {
        if (level.tiles[y]?.[x] === 'floor') tiles.push([x, y]);
      }
    }
  }
  return tiles;
}

// The zone's floor tile nearest its rect centre, or null if it has no floor.
export function centermostFloor(level, zone, cs) {
  const tiles = zoneFloorTiles(level, zone, cs);
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
