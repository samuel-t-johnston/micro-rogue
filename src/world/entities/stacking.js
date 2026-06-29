/**
 * @file Stack splitting — the one primitive for taking N units off a stacked item (see the `stackable`
 * component). Built general so a future inventory split/merge UI reuses it; the ranged/throw path calls
 * it with n = 1 to peel a single projectile off a quiver or javelin bundle. See
 * docs/design/ranged-weapons.md.
 */

/**
 * Splits `n` units off the stack `source` into a separate entity holding those units, decrementing the
 * source. Returns the entity that carries the split-off units:
 *
 *   - **n ≥ the source's count** (the whole stack is taken) → returns `source` itself, count unchanged,
 *     identity preserved (mirrors how a single thrown item flies as itself). The source no longer
 *     belongs in its container; the caller removes it from wherever it lived (equipment slot, inventory)
 *     — detect this case by identity: `result === source`.
 *   - **n < count** → returns a NEW entity with `count: n` and deep copies of the source's components,
 *     leaving `source` in place with `count - n`.
 *
 * A source with no `stackable` component counts as a single unit, so it always returns `source` (the
 * belt-and-suspenders that lets a non-stacking item flow through the same path). Item components are
 * plain serializable data with no entity references, so a per-component `structuredClone` is a safe,
 * complete copy.
 *
 * @param {object} source - The stacked (or single) item entity.
 * @param {number} n - Units to split off; must be ≥ 1.
 * @param {object} registry - The entity registry (creates the clone, maintaining its index).
 * @returns {object} The entity holding the split-off units (a clone, or `source` when taken whole).
 */
export function splitStack(source, n, registry) {
  if (n < 1) throw new Error('splitStack requires n >= 1');

  const stack = source.components.get('stackable');
  const count = stack?.count ?? 1;
  if (n >= count) return source; // whole stack taken; caller removes it from its container

  const clone = registry.createEntity();
  for (const [name, value] of source.components) {
    registry.addComponent(clone, name, structuredClone(value));
  }
  clone.components.get('stackable').count = n;
  stack.count -= n;
  return clone;
}
