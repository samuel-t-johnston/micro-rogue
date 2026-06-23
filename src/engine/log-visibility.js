/**
 * Pure visibility rule for game-log entries, kept separate from the game scene so the
 * FOV policy is unit-testable without a renderer. The scene supplies the lookups
 * (player id, the player's currently-visible tile set, and an id→position resolver);
 * this decides whether the player could perceive a given entry.
 *
 * Rules, in order:
 *   1. The player's own actions, and anything happening to them, always surface.
 *   2. With no FOV data, hide nothing.
 *   3. Otherwise anchor the entry to tiles — an explicit snapshot `pos` (e.g. a death
 *      whose entity is torn down right after logging) plus any live actor/target tile —
 *      and show it if ANY of those tiles is currently seen.
 *   4. An entry with no spatial anchor at all is global/narration → always show.
 */
export function isEntryVisible(entry, { playerId, visibleTiles, getPosition }) {
  if (entry.actor === playerId || entry.target === playerId) return true;

  if (!visibleTiles) return true;

  const positions = [];
  if (entry.pos) positions.push(entry.pos);
  for (const id of [entry.actor, entry.target]) {
    if (id == null) continue;
    const pos = getPosition(id);
    if (pos) positions.push(pos);
  }

  if (positions.length === 0) return true;

  return positions.some(p => visibleTiles.has(`${p.x},${p.y}`));
}
