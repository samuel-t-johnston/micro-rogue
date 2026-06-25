/**
 * Player goal: automatically picks up a single item when the player lands on its tile. Skips if
 * there is buffered player input, or if the player hasn't moved since the last time this goal ran
 * (which prevents repeated firing while standing still on an item tile).
 */
export const playerAutoPickup = {
  evaluate(context) {
    const { selfState, level, memory, hasPendingInput } = context;

    // Unlikely timing, but if the player tapped or pressed something while auto-pickup was queued, cancel it.
    if (hasPendingInput()) return null;

    const { x, y } = selfState.position;
    const lastPos = memory.autoPickupLastPos;
    const moved = !lastPos || lastPos.x !== x || lastPos.y !== y;
    memory.autoPickupLastPos = { x, y };

    if (!moved) return null;

    const itemsHere = [...level.getEntitiesAt(x, y)].filter((e) => e.components.has('item'));
    if (itemsHere.length !== 1) return null;

    return { action: { type: 'pickup', itemEntityId: itemsHere[0].id } };
  },
};
