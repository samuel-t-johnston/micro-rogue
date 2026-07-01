// Emergency circuit breaker: the most consecutive free actions a non-player entity may take in one
// turn burst before the loop force-consumes its turn. A free action re-adds the energy it just spent
// (see the inner loop), so a goal stack that deterministically emits a free action — a misfire, a free
// no-op — every evaluation would spin forever. This cap makes that a logged, recoverable hiccup instead
// of a frozen tab. Set high enough that no legitimate burst of free actions reaches it.
export const MAX_CONSECUTIVE_FREE_ACTIONS = 50;

/**
 * Creates the turn loop using the energy accumulator model (see docs/design/turn-order.md).
 * Entities act when their accumulator reaches 1. Speed < 1 acts less than once per round;
 * speed > 1 acts more. Default speed is 1.
 *
 * Dependencies are injected rather than imported so the turn module can be swapped without
 * touching the action system or entity layer.
 * - `onTurnStart(entity)` fires the instant before an entity acts — every other entity has
 *   resolved since it last acted, so the world is fully settled. The autosave hook snapshots here.
 * - `onTurnEnd(entity, { free })` fires symmetrically the instant after the entity's action
 *   resolves (`free` is the action's free-action flag); the win-condition check rides it.
 * - `onFreeActionLimit(entity, count)` fires when the emergency breaker trips (see
 *   MAX_CONSECUTIVE_FREE_ACTIONS) — a hook for logging the misbehaving entity.
 * - `initialTurnCount` seeds the player turn count when loading a save (fresh games pass 0).
 */
export function createTurnManager({
  getActiveEntities,
  invokeAction,
  onTurnStart,
  onTurnEnd,
  onFreeActionLimit,
  initialTurnCount = 0,
}) {
  const queue = []; // ordered list of entities
  let playerTurnCount = initialTurnCount;
  let currentEntity = null;
  let running = false;

  function rescan() {
    const active = new Set(getActiveEntities());
    for (let i = queue.length - 1; i >= 0; i--) {
      if (!active.has(queue[i])) queue.splice(i, 1);
    }
    const inQueue = new Set(queue);
    for (const entity of active) {
      if (!inQueue.has(entity)) queue.push(entity);
    }
  }

  async function tick() {
    while (running) {
      rescan();

      if (queue.length === 0) {
        // Yield to macrotasks so the browser stays responsive while idle.
        // Using setTimeout (not Promise.resolve) is essential: microtask-only
        // yields starve macrotask callbacks (including test stop() calls) forever.
        await new Promise((r) => setTimeout(r, 0));
        continue;
      }

      const entity = queue.shift();
      currentEntity = entity;
      const turnTaker = entity.components.get('turnTaker');

      if (turnTaker) {
        turnTaker.accumulator += turnTaker.speed;

        if (turnTaker.accumulator >= 1) {
          let consecutiveFree = 0;
          while (turnTaker.accumulator >= 1) {
            turnTaker.accumulator -= 1;
            turnTaker.actCount = (turnTaker.actCount ?? 0) + 1; // per-entity clock; ?? guards old saves
            onTurnStart?.(entity);
            const free = await invokeAction(entity);
            const isPlayer = entity.components.has('playerControlled');

            // Emergency breaker. A free action re-adds the energy just spent, re-running the turn; a
            // non-player whose goals keep returning free actions would loop forever. Cap it: force the
            // turn consumed and report it, so one misbehaving creature degrades to a wasted turn instead
            // of freezing the loop. The player is exempt — its free actions (look, misfire) await fresh
            // input between iterations, so they never spin.
            if (free && !isPlayer && ++consecutiveFree >= MAX_CONSECUTIVE_FREE_ACTIONS) {
              onFreeActionLimit?.(entity, consecutiveFree);
              onTurnEnd?.(entity, { free: false }); // force-consume the turn to break the loop
              break;
            }

            if (free) {
              turnTaker.accumulator += 1;
            } else {
              consecutiveFree = 0;
              if (isPlayer) playerTurnCount++;
            }
            onTurnEnd?.(entity, { free });
          }
        }
      } else {
        // A queue member without a turnTaker (e.g. a decaying sound) doesn't act on the energy
        // model — it just gets one pass per round to age. invokeAction handles the decrement and
        // self-destruct; no accumulator, no onTurnStart, no player-turn accounting.
        await invokeAction(entity);
      }

      queue.push(entity);
      rescan();

      // Yield between entity turns so macrotask callbacks (input events,
      // test assertions) can run. One setTimeout per turn is negligible for
      // a turn-based game.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  function start() {
    running = true;
    tick();
  }

  function stop() {
    running = false;
  }

  return {
    start,
    stop,
    get playerTurnCount() {
      return playerTurnCount;
    },
    get currentEntity() {
      return currentEntity;
    },
  };
}
