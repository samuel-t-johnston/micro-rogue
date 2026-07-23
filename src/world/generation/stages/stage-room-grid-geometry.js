/**
 * @file Structure-planning stage: a grid of separated rooms (the "room grid" geometry).
 * Lays out a grid of zones, deletes some cells, merges adjacent groups into larger zones, and
 * records zone adjacency — all to the blackboard, no tiles. This is the only geometry-aware planning
 * stage; `label` and `link` consume its output and are geometry-agnostic.
 * See docs/design/procedural-3x3-dungeon.md.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   cols, rows  — grid dimensions in cells (default 3 × 3)
 *   cellSize    — cell edge length in tiles (default 10)
 *   deletes     — cells to remove (default 1). Removal is connectivity-preserving: only cells whose
 *                 removal keeps the survivors orthogonally connected are eligible, so the zone graph
 *                 never splits or isolates a room. Treated as a target — stops early if none qualify.
 *   merges      — merge operations (default 1). Each fuses two adjacent groups; groups can grow into
 *                 polyomino (L/T/blob) zones. Target — stops if no adjacent groups remain.
 *   minZones    — floor on zone count for merging (default 1); merging stops before dropping below it
 *                 (e.g. set to the number of labels the labeler needs).
 *
 * Blackboard outputs:
 *   level:grid      -> { cols, rows, cellSize }
 *   level:zones     -> [{ id, cells: [[col,row],…], rect: {x,y,w,h}, labels: ['room'] }]
 *   level:adjacency -> [[idA, idB], …]   (idA < idB, deduped)
 */
import { LEVEL_GRID, LEVEL_ZONES, LEVEL_ADJACENCY } from '../blackboard-keys.js';

export const DEFAULTS = { cols: 3, rows: 3, cellSize: 10, deletes: 1, merges: 1, minZones: 1 };

/** A stable string key for a grid cell (col, row) — the cell-space analogue of tileKey. */
export const cellKey = (c, r) => `${c},${r}`;

/** True if two grid cells [col,row] are orthogonally adjacent (Manhattan distance 1). */
export const cellsAdjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

// Adjacency between two groups of cells: any cell of one orthogonally touching any cell of the other.
const groupsAdjacent = (g1, g2) => g1.some((c1) => g2.some((c2) => cellsAdjacent(c1, c2)));

// True if a set of cells is a single orthogonally-connected component.
function cellsConnected(cells) {
  if (cells.length <= 1) return true;
  const present = new Set(cells.map(([c, r]) => cellKey(c, r)));
  const seen = new Set([cellKey(cells[0][0], cells[0][1])]);
  const stack = [cells[0]];
  while (stack.length) {
    const [c, r] = stack.pop();
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = cellKey(c + dc, r + dr);
      if (present.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([c + dc, r + dr]);
      }
    }
  }
  return seen.size === cells.length;
}

// Tile-space bounding box of a group of cells.
function rectOf(cells, cellSize) {
  const cols = cells.map((c) => c[0]);
  const rows = cells.map((c) => c[1]);
  const minC = Math.min(...cols);
  const minR = Math.min(...rows);
  return {
    x: minC * cellSize,
    y: minR * cellSize,
    w: (Math.max(...cols) - minC + 1) * cellSize,
    h: (Math.max(...rows) - minR + 1) * cellSize,
  };
}

// Stable ordering key for a group of cells: its top-left cell, row-major.
function groupKey(cells) {
  const minR = Math.min(...cells.map((c) => c[1]));
  const minC = Math.min(...cells.map((c) => c[0]));
  return [minR, minC];
}

/** Runs the room-grid-geometry planning stage (see the file overview for params and outputs). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const cols = stageConfig.cols ?? DEFAULTS.cols;
  const rows = stageConfig.rows ?? DEFAULTS.rows;
  const cellSize = stageConfig.cellSize ?? DEFAULTS.cellSize;
  const deletes = stageConfig.deletes ?? DEFAULTS.deletes;
  const merges = stageConfig.merges ?? DEFAULTS.merges;
  const minZones = stageConfig.minZones ?? DEFAULTS.minZones;

  // Every grid cell starts as a candidate.
  let cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push([c, r]);
  }

  // Connectivity-preserving deletion: only remove a cell that isn't a cut vertex of the survivors.
  for (let d = 0; d < deletes; d++) {
    if (cells.length <= 1) break;
    const removable = cells.filter((_, i) => cellsConnected(cells.filter((_, k) => k !== i)));
    if (removable.length === 0) break;
    const victim = rng.pick(removable);
    cells = cells.filter((c) => c !== victim);
  }

  // Merge adjacent groups. Groups grow as they absorb neighbors (option B: polyomino zones).
  let groups = cells.map((c) => [c]);
  for (let m = 0; m < merges; m++) {
    if (groups.length <= minZones) break;
    const pairs = [];
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (groupsAdjacent(groups[i], groups[j])) pairs.push([i, j]);
      }
    }
    if (pairs.length === 0) break;
    const [i, j] = rng.pick(pairs);
    groups[i] = groups[i].concat(groups[j]);
    groups.splice(j, 1);
  }

  // Stable ids by position, so a given seed always yields the same zone numbering.
  groups.sort((a, b) => {
    const ka = groupKey(a);
    const kb = groupKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1];
  });
  const zones = groups.map((cells, id) => ({
    id,
    cells,
    rect: rectOf(cells, cellSize),
    labels: ['room'],
  }));

  const adjacency = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (groupsAdjacent(zones[i].cells, zones[j].cells))
        adjacency.push([zones[i].id, zones[j].id]);
    }
  }

  blackboard[LEVEL_GRID] = { cols, rows, cellSize };
  blackboard[LEVEL_ZONES] = zones;
  blackboard[LEVEL_ADJACENCY] = adjacency;
}
