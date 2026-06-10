import { createEventLog } from './event-log.js';

// The game's single event-log sink. Logging is a cross-cutting concern: significant
// state transitions are recorded from wherever they resolve (action handlers, the
// death chokepoint, the AI planner), most of which have no business receiving a logger
// as a parameter. So the log is an ambient singleton — like `rng` and `gameConfig` —
// rather than a dependency threaded through every signature.
//
// Entries with a `display` string surface in the player-facing message log; entries
// without one are debug-only (see docs/design/dev-tools-and-logging.md). The `turn`
// field is stamped automatically from a provider the game scene wires up, so leaf
// call sites don't need to know the turn number.
const log = createEventLog();
let turnProvider = () => 0;

export const gameLog = {
  // Wire the current-turn source once at game start. Defaults to 0 until set.
  setTurnProvider(fn) { turnProvider = fn; },

  // Record an entry. Pass a `display` string for player-visible events; omit it for
  // debug-only entries. `turn` is stamped here but may be overridden by the caller.
  add(entry) {
    log.add({ turn: turnProvider(), ...entry });
  },

  getDisplayEntries(count) { return log.getDisplayEntries(count); },
  getAll() { return log.getAll(); },

  // Clear the log and reset the turn source. Called on new-game and in test setup.
  reset() {
    log.reset();
    turnProvider = () => 0;
  },
};
