/**
 * @file Shared loader for static map layouts. Imports a map module by name and parses its
 * `tiles`/`legend` into the level's tile grid, returning its authored `entities` list (instantiated
 * later by the place-static-entities stage) and any authored `regions` (rooms + labels published to
 * the zone/room contract so the shared tail — label/stairs/spawn/populate — works over hand-authored
 * areas). Used by both the `static` and `randomStatic` structure stages. A layout can be laid down at
 * an offset via a `bounds` param, so a static block composes into an already-generated level. See
 * docs/howto/static-map-layouts.md.
 */
import { isFloorTile } from '../map/tile-registry.js';

// Default module importer: resolves the map file relative to this module's URL (GitHub Pages-safe).
// Injectable so callers (tests, alternate sources) can supply modules without the dynamic import.
function importMapModule(layoutName) {
  const url = new URL(`../../../data/maps/${layoutName}.js`, import.meta.url);
  return import(url.href);
}

/**
 * Loads a static layout module by name and parses it into `level` at the optional `bounds` offset.
 * Returns `{ entities, zones, rooms }` — authored entities (in world coords) plus the region graph
 * for the structure stage to hand to `appendZones`.
 */
export async function loadStaticLayout(layoutName, level, importLayout = importMapModule, bounds) {
  const mod = await importLayout(layoutName);
  const entities = parseLayout(mod, layoutName, level, bounds);
  const { zones, rooms, connectors } = parseRegions(mod, bounds);
  return { entities, zones, rooms, connectors };
}

/** Splits a map/paint template string into rows, dropping only leading/trailing blank lines. */
function toRows(text) {
  const rows = text.split('\n');
  while (rows.length && rows[0].trim() === '') rows.shift();
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  return rows;
}

/**
 * Parses `mod.tiles` into `level`, returning the authored entities. Owns the grid when the level has
 * none yet (standalone: the layout sizes the level); otherwise stamps the layout in place at the
 * `bounds` offset, leaving the surrounding level untouched (embedded — an earlier `box`/structure
 * stage built the grid). Entities are returned in world coords (offset by `bounds`).
 */
export function parseLayout(mod, layoutName, level, bounds) {
  // Guard the real empty condition: '' or all-whitespace. Checking rows.length === 0 was dead —
  // ''.split('\n') is [''] (length 1), so an empty layout slipped through to a 0-width level.
  const trimmed = mod.tiles.trim();
  if (trimmed === '') throw new Error(`Map "${layoutName}" is empty`);
  const rows = trimmed.split('\n');
  const width = rows[0].length;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== width) {
      throw new Error(
        `Map "${layoutName}" has inconsistent row lengths (row 0: ${width}, row ${i}: ${rows[i].length})`,
      );
    }
  }
  const height = rows.length;
  const ox = bounds?.x ?? 0;
  const oy = bounds?.y ?? 0;
  if (bounds && (width > bounds.w || height > bounds.h)) {
    throw new Error(
      `Map "${layoutName}" (${width}×${height}) does not fit within its bounds (${bounds.w}×${bounds.h})`,
    );
  }

  const parsed = rows.map((row) =>
    [...row].map((char) => {
      const tileId = mod.legend[char];
      if (!tileId) throw new Error(`Unknown symbol "${char}" in map "${layoutName}"`);
      return tileId;
    }),
  );

  // Own the grid only if no earlier stage laid tiles; otherwise stamp into the existing level in place.
  if (!level.tiles.length) {
    level.width = bounds ? bounds.x + bounds.w : width;
    level.height = bounds ? bounds.y + bounds.h : height;
    level.tiles = Array.from({ length: level.height }, () =>
      Array.from({ length: level.width }, () => 'wall'),
    );
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (level.tiles[oy + y]?.[ox + x] !== undefined) level.tiles[oy + y][ox + x] = parsed[y][x];
    }
  }

  return (mod.entities ?? []).map((e) => ({ ...e, x: e.x + ox, y: e.y + oy }));
}

/**
 * Parses a layout's optional `regions` into the zone/room contract (`appendZones` input) plus a list
 * of connector tiles, so authored rooms take labels/stairs/population like generated ones and the area
 * can be joined to generated ones by `stitch`. A region is a glyph in `regions.legend` mapping to
 * either a room (`{ label?, labels?, kind? }`) or a connector (`{ connector: true }` — a floor tile
 * stitch may link the area through). Tiles are marked by a `paint` layer (a grid the same size as
 * `tiles`, its glyphs painting membership — an irregular `{tiles}` room) or a `rects` list of
 * `{ glyph, x0, y0, x1, y1 }` (a rectangular `{x0..y1}` room). All coords offset by `bounds`. Returns
 * `{ zones, rooms, connectors }` (empty when no regions). Connector glyphs make no zone and must sit on
 * floor. Untagged floor is left unregioned, so a layout can hand-author some rooms and leave the rest
 * to `populate`.
 */
export function parseRegions(mod, bounds) {
  const spec = mod.regions;
  if (!spec) return { zones: [], rooms: {}, connectors: [] };
  const legend = spec.legend ?? {};
  const ox = bounds?.x ?? 0;
  const oy = bounds?.y ?? 0;
  const tileRows = toRows(mod.tiles);
  const isFloor = (lx, ly) => isFloorTile(mod.legend[tileRows[ly]?.[lx]]);

  // glyph -> accumulated tiles (world coords, deduped) + how it was defined (for the room shape below).
  const acc = new Map();
  const rec = (glyph) => {
    if (!legend[glyph]) throw new Error(`Region glyph "${glyph}" is not in the regions legend`);
    if (!acc.has(glyph)) acc.set(glyph, { tiles: [], seen: new Set(), rects: 0, painted: false });
    return acc.get(glyph);
  };
  // Local (lx,ly): validated (connectors must be floor) then stored offset into world coords.
  const add = (glyph, r, lx, ly) => {
    if (legend[glyph].connector && !isFloor(lx, ly)) {
      throw new Error(`Connector "${glyph}" at (${lx},${ly}) is not on a floor tile`);
    }
    const k = `${lx},${ly}`;
    if (!r.seen.has(k)) {
      r.seen.add(k);
      r.tiles.push([lx + ox, ly + oy]);
    }
  };

  if (spec.paint != null) {
    const paint = toRows(spec.paint);
    const w = tileRows[0]?.length ?? 0;
    if (paint.length !== tileRows.length || paint.some((row) => row.length !== w)) {
      throw new Error('regions.paint must match the tile grid dimensions');
    }
    for (let y = 0; y < paint.length; y++) {
      for (let x = 0; x < paint[y].length; x++) {
        const g = paint[y][x];
        if (legend[g]) {
          const r = rec(g);
          r.painted = true;
          add(g, r, x, y);
        }
      }
    }
  }

  for (const { glyph, x0, y0, x1, y1 } of spec.rects ?? []) {
    const r = rec(glyph);
    r.rects++;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) add(glyph, r, x, y);
    if (r.rects === 1 && !r.painted && !legend[glyph].connector)
      r.rect = { x0: x0 + ox, y0: y0 + oy, x1: x1 + ox, y1: y1 + oy };
  }

  // Stable dense ids by glyph (connectors skipped, so room ids stay dense), so a given layout always
  // numbers its rooms the same way.
  const zones = [];
  const rooms = {};
  const connectors = [];
  let id = 0;
  for (const glyph of [...acc.keys()].sort()) {
    const r = acc.get(glyph);
    const desc = legend[glyph];
    if (desc.connector) {
      connectors.push(...r.tiles);
      continue;
    }
    const authored = desc.labels ?? (desc.label != null ? [desc.label] : []);
    const zone = {
      id,
      cells: [[id, 0]],
      rect: boundsOf(r.tiles),
      labels: ['room', ...authored],
      origin: 'tagged',
    };
    if (desc.kind) zone.kind = desc.kind;
    zones.push(zone);
    // A single rect with no paint stays a rectangle (like BSP rooms); anything else is a tile set.
    rooms[`${id},0`] = r.rect ?? { tiles: r.tiles };
    id++;
  }
  return { zones, rooms, connectors };
}

/** Axis-aligned bounding box {x,y,w,h} of a tile list. */
function boundsOf(tiles) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of tiles) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
