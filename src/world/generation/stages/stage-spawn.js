// Finishing stage: marks where the player arrives. Places an `entryPoint` entity on a floor tile in
// the `stairs-up` zone (the classic "arrive on the up-stairs"); the game scene reads it via
// resolveSpawn. Kept separate from the stairs stage so the arrival point can move independently
// later. See docs/design/procedural-3x3-dungeon.md.
import { components } from '../../components.js';

// Floor tiles within a zone's cells.
function zoneFloorTiles(level, zone, cs) {
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

// The floor tile closest to a zone's rect centre.
function centermost(tiles, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let best = tiles[0];
  let bestD = Infinity;
  for (const [x, y] of tiles) {
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestD) { bestD = d; best = [x, y]; }
  }
  return best;
}

export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const cs = blackboard['level:grid']?.cellSize ?? 10;

  const zone = zones.find(z => z.labels.includes('stairs-up')) ?? zones[0];
  if (!zone) { console.warn('[spawn] no zones; no entry point placed'); return; }

  const floors = zoneFloorTiles(level, zone, cs);
  if (floors.length === 0) { console.warn('[spawn] entry zone has no floor; no entry point placed'); return; }

  const [x, y] = centermost(floors, zone.rect);
  const entry = registry.createEntity();
  registry.addComponent(entry, 'position', components.position(x, y));
  registry.addComponent(entry, 'entryPoint', components.entryPoint());
  level.placeEntity(entry);
}
