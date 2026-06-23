/**
 * @file Pure renderers for inspecting generation output — used by the dev visualizer
 * (scripts/visualize-generation.mjs) and unit tests. No DOM, no game runtime.
 * See docs/design/procedural-3x3-dungeon.md (Visualization & debug tooling).
 */
import { getTileType } from '../tile-registry.js';

function tileChar(id) {
  if (id == null) return ' ';
  try {
    return getTileType(id).symbol ?? '?';
  } catch {
    return '?';
  }
}

/**
 * The level's tile grid as text (`#` wall, `.` floor, etc.), with entity glyphs overlaid where they
 * have one. Returns a placeholder until a carve stage has produced tiles.
 */
export function levelToAscii(level) {
  if (!level || !level.width || !level.height || !level.tiles?.length) {
    return '(no tiles carved yet)';
  }
  const grid = [];
  for (let y = 0; y < level.height; y++) {
    const row = [];
    for (let x = 0; x < level.width; x++) row.push(tileChar(level.tiles[y]?.[x]));
    grid.push(row);
  }
  for (const entity of level.entities ?? []) {
    const pos = entity.components.get('position');
    const r = entity.components.get('renderable');
    if (pos && r?.glyph && grid[pos.y]?.[pos.x] !== undefined) grid[pos.y][pos.x] = r.glyph;
  }
  return grid.map((row) => row.join('')).join('\n');
}

/** The planning graph as a text summary: zones (with labels/cells/rect), links, and raw adjacency. */
export function zonesToText(blackboard) {
  const zones = blackboard['level:zones'] ?? [];
  const links = blackboard['level:links'] ?? [];
  const adjacency = blackboard['level:adjacency'] ?? [];
  const lines = [`Zones (${zones.length}):`];
  for (const z of zones) {
    const cells = z.cells.map((c) => `(${c[0]},${c[1]})`).join(' ');
    const rect = z.rect ? `${z.rect.x},${z.rect.y} ${z.rect.w}x${z.rect.h}` : '';
    lines.push(`  ${z.id} [${z.labels.join(', ')}]  cells=${cells}  rect=${rect}`);
  }
  lines.push(`Links (${links.length}): ${links.map((l) => `${l.a}-${l.b}`).join(', ')}`);
  lines.push(
    `Adjacency (${adjacency.length}): ${adjacency.map(([a, b]) => `${a}-${b}`).join(', ')}`,
  );
  return lines.join('\n');
}

/**
 * The planning graph as a Mermaid flowchart: links solid, adjacency-without-a-link dashed.
 * Topologically faithful, not spatially — Mermaid auto-lays-out nodes (see the design doc).
 */
export function zonesToMermaid(blackboard) {
  const zones = blackboard['level:zones'] ?? [];
  const links = blackboard['level:links'] ?? [];
  const adjacency = blackboard['level:adjacency'] ?? [];
  const linked = new Set(links.map((l) => `${l.a},${l.b}`));
  const out = ['flowchart TD'];
  for (const z of zones) {
    const special = z.labels.filter((l) => l !== 'room');
    out.push(`  z${z.id}["${special.length ? `${z.id} · ${special.join('/')}` : z.id}"]`);
  }
  for (const l of links) out.push(`  z${l.a} --- z${l.b}`);
  for (const [a, b] of adjacency) if (!linked.has(`${a},${b}`)) out.push(`  z${a} -.- z${b}`);
  return out.join('\n');
}
