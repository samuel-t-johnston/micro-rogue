export function createEventLog() {
  const entries = [];

  function add(entry) {
    entries.push(entry);
  }

  // Returns up to `count` most-recent entries that have a display string.
  function getDisplayEntries(count) {
    const display = entries.filter(e => e.display != null);
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
