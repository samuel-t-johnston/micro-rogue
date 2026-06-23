/**
 * Creates the event log — an append-only buffer of game events. Entries with a `display`
 * string are player-facing; the rest are debug/AI-trace records. A `seen` flag marks
 * whether a display entry was perceivable when logged.
 */
export function createEventLog() {
  const entries = [];

  function add(entry) {
    entries.push(entry);
  }

  // Returns up to `count` most-recent player-facing entries: those with a display
  // string that were also perceivable when logged (`seen !== false`). Entries the
  // visibility provider never classified (`seen` undefined) default to shown.
  function getDisplayEntries(count) {
    const display = entries.filter((e) => e.display != null && e.seen !== false);
    return display.slice(-count);
  }

  function getAll() {
    return entries;
  }

  // Clears the log. Used on new-game (turn counts restart) and in test setup so
  // entries from one run/test don't leak into the next.
  function reset() {
    entries.length = 0;
  }

  return { add, getDisplayEntries, getAll, reset };
}
