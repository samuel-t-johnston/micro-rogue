/**
 * @file Attribute accessors — the single place attribute math happens. Typed per flavor so callers
 * never parse a flavor-tagged result: gameplay code always knows what it is touching (getScore for a
 * score, getPool/adjustPool for a pool, get/addToAccumulator for an accumulator). Effective values are
 * derived on read and never cached — score = resolve(base + equipment mods); a pool's max is derived
 * and its current clamped to it; accumulators are monotonic. The generic describeAttribute/
 * listAttributes pair is for the display layer, the only consumer that switches on flavor. Read state
 * lives in the entity's `attributes` component. See docs/design/attribute-system.md.
 */
import { getDefinition, allDefinitions } from './attribute-registry.js';
import { Flavors } from './attribute-flavors.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const stateOf = (entity) => entity.components.get('attributes');

// Writes require an existing `attributes` component: attaching one needs the registry (to keep its
// reverse component index correct), which the accessors deliberately don't hold. Entities that own
// attributes get the component at construction/migration; writing to one without it is a programming
// error — gameplay consumers guard with hasPool()/hasStoredAttribute() first (as effect-damage guards).
function requireState(entity, name) {
  const state = stateOf(entity);
  if (!state) throw new Error(`Cannot set "${name}": entity has no attributes component`);
  return state;
}

function requireFlavor(def, flavor) {
  if (def.flavor !== flavor) {
    throw new Error(`Attribute "${def.name}" is a ${def.flavor}, not a ${flavor}`);
  }
}

// Summed equipment attributeModifiers for `name` across every worn item.
function sumEquipmentMods(entity, name) {
  const wears = entity.components.get('wearsEquipment');
  let total = 0;
  for (const item of Object.values(wears?.slots ?? {})) {
    total += item?.components.get('attributeModifiers')?.[name] ?? 0;
  }
  return total;
}

// The context handed to a definition's resolve/resolveMax formula.
function resolveContext(entity, name, base) {
  return {
    base,
    mods: sumEquipmentMods(entity, name),
    entity,
    score: (n) => getScore(entity, n),
    accumulated: (n) => getAccumulator(entity, n),
    pool: (n) => getPool(entity, n),
  };
}

/**
 * Storage-presence introspection: whether the entity's `attributes` component *stores a key* named
 * `name`. For **display/enumeration only** (it backs `listAttributes`). It is **not** a "does this
 * entity have stat X" test — the system is default-tolerant (a missing key resolves to the definition
 * default), and pools split storage into a current (`name`) and a base (`${name}Base`), so a
 * full-health creature stores no `hp`. For gameplay presence use `getScore`/`getPool`/`hasPool`.
 */
export function hasStoredAttribute(entity, name) {
  const state = stateOf(entity);
  return state != null && Object.prototype.hasOwnProperty.call(state, name);
}

/**
 * Whether the entity has pool `name` set up on it — i.e. it stores either the pool's current (`name`)
 * or its base (`${name}Base`). Since a pool's current defaults to full when unstored, an undamaged
 * entity carries only the base; damageability and effect targeting must key on this, not on
 * `hasStoredAttribute(entity, 'hp')`, which would miss a full-health creature that never took a hit.
 */
export function hasPool(entity, name) {
  return hasStoredAttribute(entity, name) || hasStoredAttribute(entity, `${name}Base`);
}

/** Effective value of a score attribute: resolve(stored base or default, + equipment mods). */
export function getScore(entity, name) {
  const def = getDefinition(name);
  requireFlavor(def, Flavors.SCORE);
  const base = stateOf(entity)?.[name] ?? def.default ?? 0;
  const resolve = def.resolve ?? ((ctx) => ctx.base + ctx.mods);
  return resolve(resolveContext(entity, name, base));
}

/** Sets a score's stored base (character creation, allocation, level-up rewards). */
export function setScoreBase(entity, name, value) {
  requireFlavor(getDefinition(name), Flavors.SCORE);
  requireState(entity, name)[name] = value;
}

/** A pool's `{ current, max }`: max is derived; current is the stored value clamped to [0, max]
 *  (an absent current reads as full). The pool's per-entity raw base — the flat value stat scaling
 *  and equipment add onto in `resolveMax` — is stored under the companion key `${name}Base` (e.g.
 *  `hpBase`), separate from the mutable current so damage never shrinks the max. It is passed to the
 *  formula as `ctx.base`; an absent base falls back to the definition's `base`, then 0. */
export function getPool(entity, name) {
  const def = getDefinition(name);
  requireFlavor(def, Flavors.POOL);
  const base = stateOf(entity)?.[`${name}Base`] ?? def.base ?? 0;
  const max = def.resolveMax(resolveContext(entity, name, base));
  const stored = stateOf(entity)?.[name];
  return { current: clamp(stored ?? max, 0, max), max };
}

/** Adds `delta` (damage negative, heal positive) to a pool's current, clamped to [0, max]. */
export function adjustPool(entity, name, delta) {
  const { current, max } = getPool(entity, name);
  const next = clamp(current + delta, 0, max);
  requireState(entity, name)[name] = next;
  return { current: next, max };
}

/** Sets a pool's current directly (e.g. fill to max on level-up), clamped to [0, max]. */
export function setPoolCurrent(entity, name, value) {
  const { max } = getPool(entity, name);
  const next = clamp(value, 0, max);
  requireState(entity, name)[name] = next;
  return { current: next, max };
}

/** Value of an accumulator attribute (default when unset). */
export function getAccumulator(entity, name) {
  const def = getDefinition(name);
  requireFlavor(def, Flavors.ACCUMULATOR);
  return stateOf(entity)?.[name] ?? def.default ?? 0;
}

/** Adds a non-negative amount to an accumulator (monotonic); returns the new total. */
export function addToAccumulator(entity, name, amount) {
  if (amount < 0) throw new Error(`addToAccumulator amount must be ≥ 0, got ${amount}`);
  requireFlavor(getDefinition(name), Flavors.ACCUMULATOR);
  const next = getAccumulator(entity, name) + amount;
  requireState(entity, name)[name] = next;
  return next;
}

/** Registry-ordered names of the attributes this entity carries stored state for. */
export function listAttributes(entity) {
  return allDefinitions()
    .map((d) => d.name)
    .filter((name) => hasStoredAttribute(entity, name));
}

/**
 * A flavor-tagged, resolved view of one attribute for the display layer: always `{ name, flavor,
 * shortLabel, longLabel }`, plus `value` for score/accumulator or `current`+`max` for a pool.
 */
export function describeAttribute(entity, name) {
  const def = getDefinition(name);
  const meta = { name, flavor: def.flavor, shortLabel: def.shortLabel, longLabel: def.longLabel };
  if (def.flavor === Flavors.POOL) return { ...meta, ...getPool(entity, name) };
  if (def.flavor === Flavors.ACCUMULATOR) return { ...meta, value: getAccumulator(entity, name) };
  return { ...meta, value: getScore(entity, name) };
}
