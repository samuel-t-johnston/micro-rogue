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
//
// `seen` (could the player perceive this when it happened?) is stamped the same way,
// from a visibility provider. Capturing it at write-time is deliberate: FOV is temporal,
// so a fight glimpsed on turn 5 stays shown — and one behind a door stays hidden — no
// matter how FOV shifts later. Leaf call sites already pass the entity ids the provider
// needs (`actor`/`target`, plus an optional `pos`), so they stay FOV-agnostic.
const log = createEventLog();
let turnProvider = () => 0;
let visibilityProvider = () => true;

export const gameLog = {
  // Wire the current-turn source once at game start. Defaults to 0 until set.
  setTurnProvider(fn) {
    turnProvider = fn;
  },

  // Wire the player-visibility source once at game start. Given the entry, returns
  // whether the player could perceive it. Defaults to "always visible" (tests/headless).
  setVisibilityProvider(fn) {
    visibilityProvider = fn;
  },

  // Record an entry. Pass a `display` string for player-visible events; omit it for
  // debug-only entries. `turn` and `seen` are stamped here; either may be overridden
  // by the caller (the trailing spread wins).
  add(entry) {
    log.add({ turn: turnProvider(), seen: visibilityProvider(entry), ...entry });
  },

  getDisplayEntries(count) {
    return log.getDisplayEntries(count);
  },
  getAll() {
    return log.getAll();
  },

  // Clear the log and reset the injected sources. Called on new-game and in test setup.
  reset() {
    log.reset();
    turnProvider = () => 0;
    visibilityProvider = () => true;
  },
};
