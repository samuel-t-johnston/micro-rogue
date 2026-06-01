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

  return { add, getDisplayEntries, getAll };
}
