import { gameLog } from '../../engine/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log-text.js';

/**
 * Moves an equippable item from the actor's inventory into its equipment slot. If the slot is
 * already occupied, the previously equipped item is unequipped back into inventory first (atomic swap).
 * @returns {boolean} Always `false` — equipping consumes the turn.
 */
export function executeEquip(actor, action, _level, _registry) {
  const item = actor.components.get('inventory')?.items.find((e) => e.id === action.itemEntityId);
  if (!item) return false;

  const equippable = item.components.get('equippable');
  if (!equippable) return false;

  const wears = actor.components.get('wearsEquipment');
  if (!wears) return false;

  const { slot } = equippable;
  if (!(slot in wears.slots)) return false;

  const inventory = actor.components.get('inventory');

  const previouslyEquipped = wears.slots[slot];
  if (previouslyEquipped) {
    previouslyEquipped.components.get('item').location = { type: 'inventory', ownerId: actor.id };
    inventory.items.push(previouslyEquipped);
  }

  const idx = inventory.items.indexOf(item);
  if (idx >= 0) inventory.items.splice(idx, 1);

  wears.slots[slot] = item;
  item.components.get('item').location = { type: 'equipped', ownerId: actor.id, slot };

  // An occupied slot is an atomic swap: the displaced item returns to inventory,
  // so log that as its own unequip before logging the equip.
  if (previouslyEquipped) {
    gameLog.add({
      actor: actor.id,
      action: 'unequip',
      item: previouslyEquipped.id,
      display: `${subject(actor)} ${conjugate(actor, 'unequip', 'unequips')} the ${itemName(previouslyEquipped)}.`,
    });
  }
  gameLog.add({
    actor: actor.id,
    action: 'equip',
    item: item.id,
    display: `${subject(actor)} ${conjugate(actor, 'equip', 'equips')} the ${itemName(item)}.`,
  });

  return false;
}
