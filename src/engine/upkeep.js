/**
 * @file The per-player-turn upkeep registry — "once per player turn, after the world has settled."
 *
 * This is the documented home for world updates that should happen exactly once each player turn:
 * scent diffusion and autosave today; status-effect ticks, regeneration, weather later. Rather than
 * burying each in the game-scene turn-start closure, they register here as ordered steps.
 *
 * Run order is load-bearing: scent must diffuse *before* autosave so a reload restores the
 * up-to-date field. Each step receives a context ({ level, registry, player }) so it reads the
 * *current* level across transitions instead of closing over a stale one. The game scene drives
 * run() from the turn manager's onTurnStart, for the player only.
 */
const steps = new Map(); // name -> fn(context)

/** Ordered registry of upkeep steps run once per player turn. Register with a unique name. */
export const upkeep = {
  // Registers (or replaces, by name) a step. Insertion order is run order; replacing keeps position.
  register(name, fn) { steps.set(name, fn); },

  // Runs every registered step in order with the given context.
  run(context) {
    for (const step of steps.values()) step(context);
  },

  // Clears all steps (new game / test isolation).
  reset() { steps.clear(); },
};
