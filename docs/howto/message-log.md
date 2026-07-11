# Message Log

*The bottom-left log widget: ghost lines, the icon, and the expandable overlay.*

The widget lives in [`src/ui/widgets/message-log.js`](../../src/ui/widgets/message-log.js). It reads
straight from the [event log](../design/dev-tools-and-logging.md) via providers the game scene
injects — it never holds its own copy of the messages.

## View states

Tapping the icon cycles through `LogViewState`:

| State      | Icon | Shows                                                                 |
| ---------- | ---- | -------------------------------------------------------------------- |
| `GHOST`    | `≡`  | Closed: the last few player-visible lines fade in above the icon.    |
| `EXPANDED` | `☰`  | Scrollable overlay of the full player-visible history.               |
| `DEBUG`    | `{}` | Scrollable overlay of **every** event-log entry.                     |

`GHOST → EXPANDED → DEBUG → closed`. The `DEBUG` step only appears when
`gameConfig.debugEnabled` is true; otherwise `EXPANDED` closes straight back to `GHOST`. The
overlay also closes on its `✕`, on Escape, or on a closing tap of the icon.

This gates on the build flag, **not** on the live debug overlay (the backtick key). They are
independent: you can read the debug log without the FOV/scent overlay on, and vice versa.

## Visible vs. debug lines

`EXPANDED` is exactly what the player sees — `getDisplayEntries`, i.e. entries with a `display`
string that were `seen` when logged. Every line renders in `theme.text`.

`DEBUG` shows `getAll()`. A line is a *debug line* when the player could *not* perceive it — no
`display` string, or stamped `seen: false` — i.e. precisely the lines that never reach the
player-facing log. Debug lines with no `display` are rendered from their structured fields, and
every line is prefixed with its turn (`T<turn>`).

Debug lines carry **two redundant cues**, not just color: they render in `theme.debug` *and* are
wrapped in braces (`{T6 action=move actor=goblin-2}`). The redundancy is deliberate
accessibility — light-green vs. light-red is a colorblind failure mode, so shape has to say the
same thing the color does. The leading `{` also survives horizontal clipping of a long line, and
the braces echo the `{}` debug-mode icon. The debug color is a theme token (`--color-debug`) so
it tracks the palette — see [theme.md](theme.md).

## Modal behavior

While open, the overlay is modal: its `handleInput` intercepts every event (tap, drag-to-scroll,
wheel, keys), so input can't fall through to the map. The icon is drawn last, on top of the
overlay, so it stays visible and tappable as the close affordance.

Scrolling (drag and wheel) is gesture/feel code and isn't unit-tested; the pure pieces
(state cycling, visible-vs-debug classification, scroll clamping) are covered in
`message-log.test.js`.
