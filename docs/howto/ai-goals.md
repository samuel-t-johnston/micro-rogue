# AI Goals

*How AI and player behaviour is driven by goals, and how to add a new one.*

For the design rationale (GOAP inspiration, priority model, memory), see [ai-architecture.md](../design/ai-architecture.md). This doc is the practical "how to add a goal."

## How it works

Every active entity — **player and NPC alike** — carries an ordered goal stack on its `ai` component, stored as string keys:

```js
ai: ['attack-in-range', 'flee-from-others', 'wander-aimlessly']            // a goblin
ai: ['player-hear', 'player-auto-move', 'player-auto-pickup', 'player-get-input'] // the player
```

**A goal** is an object with a single method:

```js
evaluate(context) → { action } | null
```

It returns `{ action }` to act, or `null` to fall through to the next goal.

**The registry** — [`src/ai/goals/goal-registry.js`](../../src/ai/goals/goal-registry.js)
Maps each string key to its goal object. Names (not function references) are stored on the component so it serializes cleanly.

**The evaluator** — [`src/ai/core/goal-evaluator.js`](../../src/ai/core/goal-evaluator.js)
Runs the stack top-down each turn; the **first goal to return an action wins** and evaluation stops there. Order *is* priority.

**The context** — [`src/ai/core/planning-context.js`](../../src/ai/core/planning-context.js)
Built fresh each turn: `selfState` (a read-only value snapshot — position, factions, computed `attackCapability`), `perception` (what the senses reported — see [ai-senses.md](ai-senses.md)), `memory`, `level`, `selfEntity` (the acting entity's live component graph, for goals that introspect their own inventory/equipment — see the equip goals), and `awaitInput`/`hasPendingInput` for player goals. Prefer `selfState` for reasoning about oneself in the world; reach for `selfEntity` only to walk live components `selfState` doesn't project. World perception flows only through `perception`; `selfEntity` is the agent reasoning about its own body, not the world.

## Add a new goal

### 1. Write the goal

Create `src/ai/goals/<name>.js` exporting an object with `evaluate(context)`. Return an action object ([action.md](action.md)) or `null`:

```js
export const fleeToCover = {
  evaluate(context) {
    const threat = nearestHostile(context);
    if (!threat) return null;                 // fall through
    return { action: { type: 'move', x, y } };
  },
};
```

### 2. Register it

Give it a name in the registry ([`src/ai/goals/goal-registry.js`](../../src/ai/goals/goal-registry.js)). For a shipped goal, add it to the map. From outside the module (a fork, a plugin, a test) call `registerGoal(name, goal)` — the same extension seam as `registerSense`. Either way the `ai` component references the goal by that name.

### 3. Add it to a goal stack

Insert the name into some entity's `ai` stack at the priority you want (see [creature.md](creature.md)). Its position relative to the other goals decides when it can interrupt them.

## Worth knowing

- **Order is the only priority.** There are no numeric priority fields — a goal higher in the list wins when it returns an action. Reading the stack top-to-bottom tells you the behaviour.
- **Re-evaluated every turn; interruption is emergent.** A higher goal simply returns an action this turn it didn't last turn. When it goes quiet, the lower goal it interrupted resumes — its memory was never cleared.
- **Don't forfeit with a free action.** A goal that can't make progress should return a *consumed* `wait`, not a free action, or it will spin the turn loop (see [`wander-aimlessly.js`](../../src/ai/goals/wander-aimlessly.js) and the loop guard in [action.md](action.md)).
- **Goals may write memory even when falling through.** Clearing a target key whose cancel condition fired is a legitimate side effect during `evaluate`. Player goals coordinate through shared memory this way (`player-get-input` writes `autoMoveTarget`; `player-auto-move` reads and clears it).
- **Perception is captured to memory selectively, outside the goal stack.** A creature with `memory.remembersEnemies` gets `memory.lastKnownEnemy = { pos, turn, source }` written each turn by the *perception-memory hook* in [`planning-context.js`](../../src/ai/core/planning-context.js) — from the nearest seen hostile (exact tile) or, failing that, a heard non-ally noise projected into a tile in its direction. The [`investigate`](../../src/ai/goals/investigate.js) goal consumes it: it walks to the lead once active pursuit (chase / attack / track-scent) has gone quiet, and clears it on arrival, unreachability, or staleness. Staleness uses the creature's **per-entity clock** — `turnTaker.actCount`, threaded into the context as `turnCount` — so "8 turns old" means 8 of *that creature's* turns. Keeping the capture in the hook (not a goal) avoids hoarding perception for creatures that don't opt in.
- **The winning goal is recorded.** `invokeAction` writes it to `ai.lastGoal` (for the debug goal inspector) and logs a `goalChange` when it shifts — you don't do this in the goal.
