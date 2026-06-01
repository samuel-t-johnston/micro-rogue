// Turn loop using the energy accumulator model (see docs/design/turn-order.md).
// Entities act when their accumulator reaches 1. Speed < 1 acts less than once
// per round; speed > 1 acts more. Default speed is 1.
//
// Dependencies are injected rather than imported so the turn module can be
// swapped without touching the action system or entity layer.
export function createTurnManager({ getActiveEntities, invokeAction }) {
  const queue = [];  // ordered list of entities
  let playerTurnCount = 0;
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
        await new Promise(r => setTimeout(r, 0));
        continue;
      }

      const entity = queue.shift();
      currentEntity = entity;
      const turnTaker = entity.components.get('turnTaker');

      turnTaker.accumulator += turnTaker.speed;

      if (turnTaker.accumulator >= 1) {
        while (turnTaker.accumulator >= 1) {
          turnTaker.accumulator -= 1;
          const free = await invokeAction(entity);
          if (free) {
            turnTaker.accumulator += 1;
          } else if (entity.components.has('playerControlled')) {
            playerTurnCount++;
          }
        }
      }

      queue.push(entity);
      rescan();

      // Yield between entity turns so macrotask callbacks (input events,
      // test assertions) can run. One setTimeout per turn is negligible for
      // a turn-based game.
      await new Promise(r => setTimeout(r, 0));
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
    get playerTurnCount() { return playerTurnCount; },
    get currentEntity() { return currentEntity; },
  };
}
