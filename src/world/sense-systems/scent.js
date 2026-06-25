import { DIRECTIONS_8, cardinalDirection } from '../map/geometry.js';
import { getTileType } from '../map/tile-registry.js';
import { tileKey, parseTileKey } from '../../engine/core/tile-key.js';

/**
 * @file The scent field: per-profile scalar grids on `level.scent` (Map<profile, Float32Array>), one
 * cell per tile (index y*width + x). Creatures deposit scent; it diffuses to neighbours and decays
 * each round, so a moving emitter trails a fading wake and a stationary one keeps a local cloud.
 * Trackers climb the gradient. See docs/design/scent-and-smell.md.
 */

// Tuning knobs — all scent is a single scalar per tile per profile:
const DECAY = 0.85; // multiplicative fade per round
const SPREAD = 0.2; // fraction of a tile's value that mixes outward each round
const EPSILON = 0.05; // values below this snap to 0, keeping the field sparse
const MAX = 100; // per-tile deposit ceiling

const index = (level, x, y) => y * level.width + x;

function inBounds(level, x, y) {
  return x >= 0 && y >= 0 && x < level.width && y < level.height;
}

// Scent is stopped only by solid wall tiles — not by creatures or items (a swarm must not block its
// own trail). v1: a tile blocks scent iff it's out of bounds or its tile type blocks movement.
function blocksScent(level, x, y) {
  if (!inBounds(level, x, y)) return true;
  const tileId = level.getTile(x, y);
  if (tileId == null) return true;
  try {
    return getTileType(tileId).blocksMovement;
  } catch {
    return true;
  }
}

function ensureGrid(level, profile) {
  if (!level.scent) level.scent = new Map();
  let grid = level.scent.get(profile);
  if (!grid) {
    grid = new Float32Array(level.width * level.height);
    level.scent.set(profile, grid);
  }
  return grid;
}

/** Current intensity of `profile` scent at (x, y); 0 if no field, out of bounds, or never deposited. */
export function scentAt(level, profile, x, y) {
  if (!inBounds(level, x, y)) return 0;
  const grid = level.scent?.get(profile);
  return grid ? grid[index(level, x, y)] : 0;
}

/** Adds `amount` of `profile` scent at (x, y), capped at MAX. No-op on a wall tile or non-positive add. */
export function depositScent(level, profile, x, y, amount) {
  if (amount <= 0 || blocksScent(level, x, y)) return;
  const grid = ensureGrid(level, profile);
  const i = index(level, x, y);
  grid[i] = Math.min(MAX, grid[i] + amount);
}

/**
 * Ages the field one round: decay + gated blur for every profile grid. Walls never hold or transmit
 * scent (their cells stay 0, and they contribute 0 to neighbours over the fixed /8 denominator, so
 * the field dissipates a little faster near walls).
 */
export function diffuseAndDecay(level) {
  if (!level.scent) return;
  for (const [profile, grid] of level.scent) {
    const next = new Float32Array(grid.length);
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (blocksScent(level, x, y)) continue; // walls stay 0
        let neighborSum = 0;
        for (const [dx, dy] of DIRECTIONS_8) {
          if (blocksScent(level, x + dx, y + dy)) continue;
          neighborSum += grid[index(level, x + dx, y + dy)];
        }
        const i = index(level, x, y);
        const v = (grid[i] * (1 - SPREAD) + SPREAD * (neighborSum / 8)) * DECAY;
        next[i] = v < EPSILON ? 0 : v;
      }
    }
    level.scent.set(profile, next);
  }
}

/**
 * The 8-way compass direction toward the strongest `profile` scent among open neighbours, or null if
 * no neighbour beats the current tile (a local peak — we're on/at the source). Trackers step this way.
 */
export function gradientDir(level, profile, x, y) {
  let best = scentAt(level, profile, x, y);
  let bestDir = null;
  for (const [dx, dy] of DIRECTIONS_8) {
    if (blocksScent(level, x + dx, y + dy)) continue;
    const v = scentAt(level, profile, x + dx, y + dy);
    if (v > best) {
      best = v;
      bestDir = cardinalDirection({ x, y }, { x: x + dx, y: y + dy });
    }
  }
  return bestDir;
}

/**
 * One upkeep round for the active level: age the field, then each scent source re-deposits at its
 * current tile (deposit last, so a source's own tile is always the freshest). Registered as a
 * per-player-turn upkeep step (see src/engine/turn/upkeep.js).
 */
export function scentUpkeep(level, registry) {
  diffuseAndDecay(level);
  for (const entity of registry.getEntitiesWith('scentSource')) {
    const pos = entity.components.get('position');
    const src = entity.components.get('scentSource');
    if (pos && src.profile) depositScent(level, src.profile, pos.x, pos.y, src.intensity);
  }
}

/**
 * Sparse serialization for the save (only non-zero cells): `{ profile: { "x,y": value } }`. Scent is
 * gameplay state — a reload mid-hunt must not blank the field — so it round-trips with the level.
 */
export function serializeScent(level) {
  const out = {};
  if (!level.scent) return out;
  for (const [profile, grid] of level.scent) {
    const cells = {};
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] > 0) cells[tileKey(i % level.width, Math.floor(i / level.width))] = grid[i];
    }
    if (Object.keys(cells).length > 0) out[profile] = cells;
  }
  return out;
}

/**
 * Rebuilds the dense per-profile grids from the sparse form. Tolerates a missing field (old saves
 * predate scent) by returning an empty map.
 */
export function deserializeScent(data, width, height) {
  const scent = new Map();
  for (const [profile, cells] of Object.entries(data ?? {})) {
    const grid = new Float32Array(width * height);
    for (const [key, value] of Object.entries(cells)) {
      const { x, y } = parseTileKey(key);
      grid[y * width + x] = value;
    }
    scent.set(profile, grid);
  }
  return scent;
}
