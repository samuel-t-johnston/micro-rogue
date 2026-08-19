/**
 * @file Entity tables: weighted, nestable, RNG-driven spec generators. One invocation ("roll") of a
 * table yields zero, one, or many specs — the descriptors (`item(type, count)`, and creature/furniture
 * specs later) that a placement site turns into real entities. Tables drive loot drops, chest contents,
 * and procedural floor/creature population; the caller always supplies the RNG, so the same definition
 * is deterministic under map generation's derived streams and reproducible under the gameplay stream at
 * death. See docs/design/entity-tables.md, docs/howto/loot-tables.md, and src/world/entities/item-tables.js.
 *
 * A table produces *specs*, never built entities: a spec has no placement context, so the identical
 * output lands in an inventory, a chest, or on a floor tile depending only on who resolves it. This is
 * the same spec/entity split the loadout stage already relies on.
 *
 * DETERMINISM CONTRACT — the RNG draw order of one `rollTable` is fixed and must not change casually:
 *   1. If `rolls` is a range, one draw for the roll count.
 *   2. Then one draw per roll for the weighted row pick.
 *   3. A nested table (via `ref`) recurses inside its row's generator, spending its own draws there.
 * Weight and roll-count functions must be pure (no RNG) — they read ctx only. Tables are never
 * serialized (their *output* entities are), so changing a definition needs no save migration, but it
 * does re-roll the seeds of any not-yet-generated content, exactly like the item-pool order contract.
 */

/** The canonical "no drop" generator — a row that emits nothing. Use as `row(weight, nothing)`. */
export const nothing = () => [];

/**
 * One table row: a `weight` and a spec generator `gen`.
 * @param {number | ((ctx: object) => number)} weight - Relative likelihood; a function of ctx for
 *   depth/level-scaled odds. Non-positive weights are treated as zero (the row can't be picked).
 * @param {(ctx: object) => object[]} gen - Produces this row's specs (often via `item(...)`), or
 *   delegates to another table with `ref(id)`. May return an empty array.
 */
export const row = (weight, gen) => ({ weight, gen });

/**
 * A named, nestable table.
 * @param {string} id - Stable id; how other tables reference it via `ref` and how content catalogs key it.
 * @param {string} description - Human-readable summary for authoring and debug tooling.
 * @param {object} cfg
 * @param {number | [number, number] | ((ctx: object) => number)} [cfg.rolls=1] - Independent row-picks
 *   per invocation: a fixed count, an inclusive `[min, max]` range, or a function of ctx.
 * @param {object[]} cfg.rows - The rows (see `row`).
 */
export const table = (id, description, { rolls = 1, rows }) => ({ id, description, rolls, rows });

const MAX_DEPTH = 16;

// The installed catalog: the single declared id→table map that `ref` resolves against, mirroring how
// ENTITY_PREFABS is one authored catalog of content. Set once via `useTables` at each entry point
// (main.js at startup; test setup), so tables can reference each other by id without every caller
// threading a catalog through ctx. `table()` stays a pure constructor — nothing self-registers.
let _catalog = {};

/** Installs the declared table catalog (data/tables/index.js). Call once per entry point before any roll. */
export function useTables(catalog) {
  _catalog = catalog;
}

/**
 * A generator that delegates to another table, looked up by id at roll time against the installed
 * catalog. Late-binding by id (rather than capturing the table object) keeps definitions inspectable,
 * lets tables reference each other regardless of declaration order, and localizes cycle detection here.
 */
export const ref = (id) => (ctx) => {
  const t = _catalog[id];
  if (!t)
    throw new Error(`entity-table: ref to unknown table "${id}" (not installed via useTables)`);
  const depth = (ctx._depth ?? 0) + 1;
  if (depth > MAX_DEPTH) throw new Error(`entity-table: nesting too deep at "${id}" (cycle?)`);
  return rollTable(t, { ...ctx, _depth: depth });
};

const resolveWeight = (w, ctx) => (typeof w === 'function' ? w(ctx) : w);

const resolveRolls = (rolls, ctx) => {
  if (typeof rolls === 'function') return rolls(ctx);
  if (Array.isArray(rolls)) return ctx.rng.intInclusive(rolls[0], rolls[1]);
  return rolls;
};

// One weighted row pick — a single RNG draw. Returns the chosen row, or null when every weight is
// non-positive (a table that can decline to produce anything). Mirrors the weighted-pick shape already
// used in stage-populate, so behavior reads the same across the codebase.
function pickRow(rows, ctx) {
  const ws = rows.map((r) => Math.max(0, resolveWeight(r.weight, ctx)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let t = ctx.rng.random() * total;
  for (let i = 0; i < rows.length; i++) {
    t -= ws[i];
    if (t < 0) return rows[i];
  }
  return rows[rows.length - 1];
}

/**
 * Rolls a table and returns its accumulated specs (possibly empty). See the file's determinism
 * contract for the draw order. `ctx` carries at least `{ rng }`; tables that scale on context also
 * read `depth`, `source`, `player`, etc. Nested tables (`ref`) resolve against the catalog installed
 * by `useTables`, so ctx needn't carry it.
 */
export function rollTable(table, ctx) {
  const n = resolveRolls(table.rolls, ctx);
  const out = [];
  for (let i = 0; i < n; i++) {
    const chosen = pickRow(table.rows, ctx);
    if (chosen) out.push(...chosen.gen(ctx));
  }
  return out;
}
