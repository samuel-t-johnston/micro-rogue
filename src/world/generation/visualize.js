/**
 * @file Pure renderers for inspecting generation output — used by the dev visualizer
 * (scripts/visualize-generation.mjs), the map-gen dev page, and unit tests. No DOM, no game runtime:
 * every renderer takes a level/blackboard and returns a string, so the same code runs headless (the
 * CLI writes an .html file) and in the browser (the page injects the fragment). That shared path is
 * why the two tools can't drift. See docs/design/procedural-3x3-dungeon.md (Visualization & debug
 * tooling) and docs/howto/visualizing-generation.md.
 */
import { getTileType } from '../map/tile-registry.js';
import { LEVEL_ZONES, LEVEL_ROOMS, LEVEL_ADJACENCY, LEVEL_LINKS } from './blackboard-keys.js';
import { roomTiles, isChamber } from './zone-tiles.js';

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
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const links = blackboard[LEVEL_LINKS] ?? [];
  const adjacency = blackboard[LEVEL_ADJACENCY] ?? [];
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
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const links = blackboard[LEVEL_LINKS] ?? [];
  const adjacency = blackboard[LEVEL_ADJACENCY] ?? [];
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

// ---- HTML map render (shared by the CLI and the map-gen page) ------------------------------------

const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/**
 * The CSS the HTML map render needs: one class per cell background (wall / plain floor / passage /
 * unsectioned room / up to eight cycled section tints) plus the legend row. Exported on its own so the
 * dev page can drop it into its chrome; `renderMapsDocument` inlines it for the standalone CLI file.
 * Dark-only by design — a dev tool, not the game UI.
 */
export const MAP_STYLES = `
.rogue-map { margin: 0; line-height: 1; font-size: 11px; white-space: pre; font-family: ui-monospace, Menlo, Consolas, monospace; }
.rogue-map i { display: inline-block; width: 0.75ch; text-align: center; font-style: normal; font-weight: 700; }
.rogue-map i.w { background: #14161a; }
.rogue-map i.f { background: #3a3f46; }
.rogue-map i.p { background: #2b3038; color: #8b949e; }
.rogue-map i.c { background: #2f4a3a; }
.rogue-map i.s0 { background: #26456a; }
.rogue-map i.s1 { background: #22513a; }
.rogue-map i.s2 { background: #5e3a5a; }
.rogue-map i.s3 { background: #5e5122; }
.rogue-map i.s4 { background: #2a4f5e; }
.rogue-map i.s5 { background: #5e3322; }
.rogue-map i.s6 { background: #3d3a6e; }
.rogue-map i.s7 { background: #4a5e22; }
.rogue-legend { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 12px; color: #8b949e; }
.rogue-legend i { display: inline-block; min-width: 14px; height: 14px; margin-right: 3px; border-radius: 2px; vertical-align: middle; }
`;

// Distinct section values, in first-seen order over the zone list. Both the map render and the legend
// key their tint index off this, so a section's colour matches its swatch.
function sectionsOf(zones) {
  const seen = [];
  for (const z of zones)
    if (isChamber(z) && z.section != null && !seen.includes(z.section)) seen.push(z.section);
  return seen;
}

// tile "x,y" -> background class. Chamber tiles tint by section (cycled) or the plain room colour;
// passages get their own muted class. Floor tiles in no zone (corridors, stitches, BSP halls) fall
// through to plain floor in the render below.
function tileClasses(level) {
  const bb = level.blackboard ?? {};
  const zones = bb[LEVEL_ZONES] ?? [];
  const rooms = bb[LEVEL_ROOMS] ?? {};
  const sections = sectionsOf(zones);
  const cls = new Map();
  for (const z of zones) {
    let c;
    if (!isChamber(z)) c = 'p';
    else if (z.section != null) c = `s${sections.indexOf(z.section) % 8}`;
    else c = 'c';
    for (const [x, y] of roomTiles(z, rooms)) cls.set(`${x},${y}`, c);
  }
  return cls;
}

/**
 * The level's tile grid as an HTML `<pre>` fragment: walls and floor as coloured cells (rooms tinted
 * by district/kind), the game's own entity glyphs overlaid in their glyph colours. Needs `MAP_STYLES`
 * in scope. Returns a placeholder until a carve stage has produced tiles. Pure — no DOM.
 */
export function levelToHtml(level) {
  if (!level?.width || !level?.height || !level?.tiles?.length) {
    return '<pre class="rogue-map">(no tiles carved yet)</pre>';
  }
  const cls = tileClasses(level);

  // Entity glyphs, highest render layer winning a shared tile (so a creature draws over the item it
  // stands on, as in game). Entities without a glyph (e.g. the entry-point marker) don't draw.
  const glyphs = new Map();
  for (const e of level.entities ?? []) {
    const pos = e.components.get('position');
    const r = e.components.get('renderable');
    if (!pos || !r?.glyph) continue;
    const key = `${pos.x},${pos.y}`;
    const prev = glyphs.get(key);
    const layer = r.layer ?? 0;
    if (!prev || layer >= prev.layer)
      glyphs.set(key, { ch: r.glyph, color: r.glyphColor ?? '#ffffff', layer });
  }

  const rows = [];
  for (let y = 0; y < level.height; y++) {
    let row = '';
    for (let x = 0; x < level.width; x++) {
      const base = level.tiles[y]?.[x] === 'floor' ? (cls.get(`${x},${y}`) ?? 'f') : 'w';
      const g = glyphs.get(`${x},${y}`);
      row += g
        ? `<i class="${base}" style="color:${g.color}">${esc(g.ch)}</i>`
        : `<i class="${base}">&nbsp;</i>`;
    }
    rows.push(row);
  }
  return `<pre class="rogue-map">${rows.join('\n')}</pre>`;
}

/**
 * A legend for a `levelToHtml` render: a swatch for wall / floor, one per district (named) or a plain
 * "room" swatch, and "passage" when the level has any. Section swatch colours match the render.
 */
export function mapLegendHtml(level) {
  const zones = level?.blackboard?.[LEVEL_ZONES] ?? [];
  const sections = sectionsOf(zones);
  const hasPlainChamber = zones.some((z) => isChamber(z) && z.section == null);
  const hasPassage = zones.some((z) => !isChamber(z));
  const items = ['<i class="w"></i>wall', '<i class="f"></i>floor'];
  sections.forEach((s, i) => items.push(`<i class="s${i % 8}"></i>${esc(s)}`));
  if (hasPlainChamber) items.push('<i class="c"></i>room');
  if (hasPassage) items.push('<i class="p"></i>passage');
  return `<p class="rogue-legend rogue-map">${items.join(' ')} <span>· glyphs = entities</span></p>`;
}

/**
 * Wraps rendered map panels in a standalone, self-contained HTML document — a responsive grid of
 * cards, `MAP_STYLES` inlined so the file needs nothing external. The CLI writes this; the dev page
 * builds its own chrome from `levelToHtml`/`MAP_STYLES` directly. `panels` is `[{ caption, html }]`.
 */
export function renderMapsDocument({ title = 'map-gen', legend = '', panels = [] }) {
  const cards = panels
    .map((p) => `<figure><figcaption>${esc(p.caption ?? '')}</figcaption>${p.html}</figure>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
:root { color-scheme: dark; }
body { background: #14161a; color: #c9d1d9; font-family: system-ui, sans-serif; margin: 24px; }
h1 { font-size: 16px; }
.rogue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 18px; margin-top: 12px; }
figure { margin: 0; background: #0d1013; border: 1px solid #21262d; border-radius: 8px; padding: 10px; overflow-x: auto; }
figcaption { font-size: 12px; color: #8b949e; margin-bottom: 6px; }
${MAP_STYLES}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
${legend}
<div class="rogue-grid">${cards}</div>
</body>
</html>`;
}

// ---- Config serialization (for the map-gen page: pipeline editor round-trip + static-map export) ---

const isIdent = (k) => /^[A-Za-z_$][\w$]*$/.test(k);
const jsKey = (k) => (isIdent(k) ? k : `'${k}'`);
const jsPrim = (v) =>
  typeof v === 'string' ? `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : String(v);

// One-line form; `toJsLiteral` wraps it onto multiple lines once it gets long.
function jsCompact(v) {
  if (Array.isArray(v)) return `[${v.map(jsCompact).join(', ')}]`;
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length ? `{ ${k.map((x) => `${jsKey(x)}: ${jsCompact(v[x])}`).join(', ')} }` : '{}';
  }
  return jsPrim(v);
}

/**
 * A value as a repo-style JS literal string — unquoted identifier keys, single-quoted strings, short
 * containers kept inline and longer ones wrapped and indented. Lets the map-gen page round-trip a
 * pipeline between its editor and a real `data/pipelines/*.js` file. Handles plain data (objects,
 * arrays, strings, numbers, booleans, null); not functions or other exotics.
 */
export function toJsLiteral(value, pad = '') {
  const flat = jsCompact(value);
  if (flat.length <= 64) return flat;
  const inner = `${pad}  `;
  if (Array.isArray(value)) {
    return `[\n${value.map((x) => inner + toJsLiteral(x, inner)).join(',\n')},\n${pad}]`;
  }
  const keys = Object.keys(value);
  return `{\n${keys
    .map((x) => `${inner}${jsKey(x)}: ${toJsLiteral(value[x], inner)}`)
    .join(',\n')},\n${pad}}`;
}

/**
 * A generated level serialized as an editable static-map module (the `data/maps/*.js` authoring
 * format): a symbol grid plus the placed entities as `{ type, x, y }` (chests carry `contents`, stairs
 * their `port`). The inverse of loading a static layout — for the map-gen page's "export", so a
 * promising generated floor can be hand-tuned. Best-effort on entities: it records each entity's prefab
 * type and position, which reproduces the layout but not the seeded population exactly.
 */
export function levelToStaticModule(level) {
  const rows = (level?.tiles ?? []).map((row) => row.map(tileChar).join('')).join('\n');
  const entities = [];
  for (const e of level?.entities ?? []) {
    const type = e.components.get('entityTypeId');
    const pos = e.components.get('position');
    if (!type || !pos) continue; // markers with no prefab type (e.g. the entry point) aren't authored
    const ent = { type, x: pos.x, y: pos.y };
    const inv = e.components.get('inventory');
    if (inv?.items?.length) {
      const contents = inv.items.map((i) => i.components.get('entityTypeId')).filter(Boolean);
      if (contents.length) ent.contents = contents;
    }
    const port = e.components.get('transition')?.port;
    if (port) ent.port = port;
    entities.push(ent);
  }
  return [
    "export const legend = { '.': 'floor', '#': 'wall' };",
    '',
    'export const tiles = `\\',
    `${rows}\`;`,
    '',
    `export const entities = ${toJsLiteral(entities)};`,
    '',
  ].join('\n');
}
