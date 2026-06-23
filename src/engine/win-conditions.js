/**
 * @file The win-condition evaluator — the flexible counterpart to death: a registry of named checks
 * that each receive the settled game state and decide whether the run has been won. Mirrors the
 * upkeep and goal/effect registries so devs can register their own, potentially unconventional,
 * victory conditions without touching the turn loop or the game scene.
 *
 * The game scene runs this at the end of each player turn (the only moment win state can change) and
 * routes a non-null result into its single endGame() seam — the same place player death lands. Each
 * check is fn({ registry, level, player }) -> null (keep playing) | { outcome: 'win', message }.
 */
const conditions = new Map(); // name -> fn(context)

/** Ordered registry of win-condition checks; `run` returns the first non-null result. */
export const winConditions = {
  // Registers (or replaces, by name) a condition. Insertion order is evaluation order.
  register(name, fn) { conditions.set(name, fn); },

  // Runs each condition in order, returning the first non-null result (the run is over), else null.
  run(context) {
    for (const fn of conditions.values()) {
      const result = fn(context);
      if (result) return result;
    }
    return null;
  },

  // Clears all conditions (new game / test isolation).
  reset() { conditions.clear(); },
};

/**
 * The classic escape victory, as a reusable win-condition factory: the player wins by standing on a
 * `dungeonExit` tile while carrying the item tagged with `questItemId`. Parameterized so the same
 * shape covers any "carry X to the exit" objective.
 * @param {string} questItemId - The `questItem` id the player must be carrying.
 * @param {string} message - Victory message routed to the results screen.
 * @returns {(context: { level: object, player: object }) => ({ outcome: 'win', message: string } | null)} A win-condition check.
 */
export function escapeWithQuestItem(questItemId, message) {
  return ({ level, player }) => {
    const items = player.components.get('inventory')?.items ?? [];
    if (!items.some(it => it.components.get('questItem')?.id === questItemId)) return null;

    const pos = player.components.get('position');
    if (!pos) return null;
    const onExit = [...level.getEntitiesAt(pos.x, pos.y)].some(e => e.components.has('dungeonExit'));
    return onExit ? { outcome: 'win', message } : null;
  };
}
