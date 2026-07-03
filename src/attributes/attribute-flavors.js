/**
 * @file Attribute flavors — the fixed set of access interfaces an attribute can expose. Flavor is the
 * *interface* (how an attribute is stored and accessed), orthogonal to its *formula* (how the value is
 * computed). Kept in its own dependency-free module so the registry, the accessors, and the content
 * definition set can all share it without an import cycle. See docs/design/attribute-system.md.
 */

/** The three attribute flavors. Values are the strings stored on each definition's `flavor`. */
export const Flavors = Object.freeze({
  SCORE: 'score', // Single effective value: stored base (or derived) + equipment modifiers.
  POOL: 'pool', // current + derived max; consumed and replenished.
  ACCUMULATOR: 'accumulator', // Monotonic value with threshold triggers.
});
