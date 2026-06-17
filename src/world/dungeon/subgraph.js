// Collects the transitive closure of entities reachable from `roots`, following the entity
// references that bind an entity graph together: `inventory.items` and worn `wearsEquipment.slots`
// (a container like a chest carries an `inventory`, so its contents are reached the same way).
//
// Cold storage uses this twice: to group a level's on-map entities (plus their carried/contained
// items) for freezing, and to pull the player's whole sub-graph (carried + equipped items) into
// "limbo" so they travel through a transition instead of being frozen into the level being left.
// See docs/design/map-generation.md.
//
// At runtime these refs are live entity objects (the save layer converts them to ids), so the walk
// needs no registry. Returns a Set of entities including the roots; a `found` guard makes cycles
// and shared references safe.
export function collectSubgraph(roots) {
  const found = new Set();
  const stack = [...roots];

  while (stack.length) {
    const entity = stack.pop();
    if (!entity || found.has(entity)) continue;
    found.add(entity);

    const inventory = entity.components.get('inventory');
    if (inventory) {
      for (const item of inventory.items) stack.push(item);
    }

    const equipment = entity.components.get('wearsEquipment');
    if (equipment) {
      for (const ref of Object.values(equipment.slots)) {
        if (ref) stack.push(ref);
      }
    }
  }

  return found;
}
