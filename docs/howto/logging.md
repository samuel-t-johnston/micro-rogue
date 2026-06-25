# Logging

*How to record game events — the player-facing message log and the debug/AI trace, which are the same buffer filtered two ways. For the on-screen widget see [message-log.md](message-log.md); for the design rationale see [dev-tools-and-logging.md](../design/dev-tools-and-logging.md).*

## How it works

Logging is an **ambient singleton**, [`gameLog`](../../src/engine/log/game-log.js) — like `rng` and `gameConfig`. Significant state transitions are recorded from wherever they resolve (action handlers, the death chokepoint, the AI planner), most of which have no business receiving a logger as a parameter, so the log isn't threaded through signatures. You just call:

```js
import { gameLog } from '.../engine/log/game-log.js';

gameLog.add({ actor: entity.id, action: 'attack', target: target.id, display: 'You hit the orc for 3 damage.' });
```

### Display vs. debug — one buffer, the `display` field

Every entry lands in one append-only [`event-log`](../../src/engine/log/event-log.js) buffer. The **presence of a `display` string** decides where it surfaces:

- **With `display`** → a player-facing message (shown in the [message log](message-log.md)).
- **Without `display`** → a debug-only record — AI traces, the `goalChange` entries the planner emits when a creature's behavior shifts. Visible only in the log's DEBUG view.

So the same `gameLog.add` call serves both audiences; omit `display` and the entry is silent to the player but available for debugging.

### `turn` and `seen` are stamped for you

`gameLog.add` fills two fields automatically, from providers the game scene wires up once at start:

- **`turn`** — the current player turn, from a `turnProvider`. Leaf call sites don't need to know the turn number.
- **`seen`** — whether the player could perceive this event *when it happened*, from a `visibilityProvider`. Capturing it at write time is deliberate: FOV is temporal, so a fight glimpsed on turn 5 stays shown, and one behind a door stays hidden, no matter how FOV shifts later. The policy itself is a pure, testable function — [`log-visibility.js`](../../src/engine/log/log-visibility.js) — fed the entry's `actor`/`target`/`pos` and the player's visible-tile set.

`getDisplayEntries(count)` returns the last N entries that have a `display` *and* weren't classified unseen (`seen !== false`); `getAll()` returns everything (the DEBUG view).

## Building the display string

Don't hand-format player strings at the call site — use the renderers in [`src/engine/log/text/`](../../src/engine/log/text), which keep grammar (the "You" vs "The orc" second-/third-person split, verb agreement, articles) in one place:

- **[`log-text.js`](../../src/engine/log/text/log-text.js)** — `subject` / `object` / `conjugate` / `itemName` for action lines (used by every `action-*` handler).
- **[`sound-text.js`](../../src/engine/log/text/sound-text.js)** — `describeSound` for heard percepts (see [sound.md](sound.md) / [language.md](language.md)).
- **[`smell-text.js`](../../src/engine/log/text/smell-text.js)** — `describeSmell` for scents (see [smell.md](smell.md)).

## Add a log entry

1. At the point the event resolves, call `gameLog.add({ ... })`.
2. Include `display` for anything the player should see; build it with the `text/` helpers. Omit `display` for a debug/trace record.
3. Pass `actor` (and `target`/`pos` when relevant) so the visibility provider can decide `seen` — this keeps the call site FOV-agnostic.

`gameLog.reset()` clears the buffer and the providers; it's called on new-game and in test setup so entries don't leak between runs.

## See also

- [Message log](message-log.md) — the UI widget (ghost lines, expandable overlay, DEBUG view).
- [Dev tools & logging](../design/dev-tools-and-logging.md) — the design and the visibility policy in full.
