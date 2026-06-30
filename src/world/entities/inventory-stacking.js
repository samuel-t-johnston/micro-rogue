/**
 * @file Inventory-level stacking: deciding when two item entities are the same stackable type, merging
 * picked-up items into existing stacks, and consolidating ("stack all") an inventory in place. The
 * complement to `stacking.js`'s `splitStack` (the take-N-off primitive). See docs/design/ranged-weapons.md.
 */

// Components whose data is per-instance bookkeeping, not item identity: the live `count`, where the item
// currently lives (`item.location`), and its map coordinates. Two stacks of the same thing differ in
// exactly these, so they're excluded from the stack signature.
const VOLATILE = new Set(['stackable', 'item', 'position']);

/**
 * A stable identity key for a stackable item: every non-volatile component plus the stack cap. Two
 * entities with equal signatures hold interchangeable units and may share a stack. Item components are
 * plain serializable data built by the same factory each time, so a JSON encoding is a sound identity.
 * @returns {string|null} The signature, or `null` for a non-stackable item (which never merges).
 */
export function stackSignature(item) {
  const stack = item.components.get('stackable');
  if (!stack) return null;
  const parts = [`max:${stack.maxStackSize}`];
  for (const name of [...item.components.keys()].sort()) {
    if (VOLATILE.has(name)) continue;
    parts.push(`${name}:${JSON.stringify(item.components.get(name))}`);
  }
  return parts.join('|');
}

/** Whether two item entities are stackable and represent the same type (so units can move between them). */
export function canStack(a, b) {
  const sig = stackSignature(a);
  return sig !== null && sig === stackSignature(b);
}

/**
 * Adds `item` to `inventory`, merging into existing below-max stacks of the same type first (filling
 * each in turn). Mutates counts in place. If `item` is fully absorbed it is destroyed via the registry
 * and `null` is returned; otherwise the leftover stack is pushed and returned. A non-stackable item is
 * simply pushed. The caller owns `item.location` and any logging.
 * @returns {object|null} The pushed entity, or `null` when fully merged away.
 */
export function addToInventory(inventory, item, registry) {
  const sig = stackSignature(item);
  if (sig === null) {
    inventory.items.push(item);
    return item;
  }

  const incoming = item.components.get('stackable');
  for (const existing of inventory.items) {
    if (incoming.count <= 0) break;
    if (stackSignature(existing) !== sig) continue;
    const target = existing.components.get('stackable');
    const space = target.maxStackSize - target.count;
    if (space <= 0) continue;
    const moved = Math.min(space, incoming.count);
    target.count += moved;
    incoming.count -= moved;
  }

  if (incoming.count <= 0) {
    registry.destroyEntity(item);
    return null;
  }
  inventory.items.push(item);
  return item;
}

/** Stacks of `item`'s type that sit below their cap, where units could still move. */
function belowMaxPeers(items, sig) {
  return items.filter((it) => {
    if (stackSignature(it) !== sig) return false;
    const stack = it.components.get('stackable');
    return stack.count < stack.maxStackSize;
  });
}

/**
 * Whether `item`'s type has two or more below-max stacks in `items` — the condition under which a
 * "stack all" actually consolidates anything (a lone stack, or a single partial beside full ones, can't).
 */
export function hasStackablePeers(items, item) {
  const sig = stackSignature(item);
  return sig !== null && belowMaxPeers(items, sig).length >= 2;
}

/**
 * Consolidates every inventory stack matching `item`'s type into as few stacks as possible: pours from
 * the smallest stacks into the largest, then removes (and destroys) the emptied ones. Other item types
 * are untouched. Mutates `inventory.items` and the stack counts in place.
 */
export function stackAll(inventory, item, registry) {
  const sig = stackSignature(item);
  if (sig === null) return;

  // Descending by count: largest are the fill targets, smallest are drained first.
  const group = inventory.items
    .filter((it) => stackSignature(it) === sig)
    .sort((a, b) => b.components.get('stackable').count - a.components.get('stackable').count);

  let dest = 0;
  let src = group.length - 1;
  while (dest < src) {
    const into = group[dest].components.get('stackable');
    const from = group[src].components.get('stackable');
    if (into.count >= into.maxStackSize) {
      dest++;
      continue;
    }
    if (from.count <= 0) {
      src--;
      continue;
    }
    const moved = Math.min(into.maxStackSize - into.count, from.count);
    into.count += moved;
    from.count -= moved;
  }

  for (const stack of group) {
    if (stack.components.get('stackable').count <= 0) {
      const idx = inventory.items.indexOf(stack);
      if (idx >= 0) inventory.items.splice(idx, 1);
      registry.destroyEntity(stack);
    }
  }
}
