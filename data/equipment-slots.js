// Canonical set of equipment slots. New slots are added here and referenced
// everywhere else via the Slots enum — never as bare strings — so typos crash
// at import time instead of silently misrouting equip attempts.
//
// HUMANOID_SLOTS is the default slot loadout for player-shaped characters.
// Non-humanoid entities can declare their own subset (or superset) when given
// a wearsEquipment component.
export const Slots = Object.freeze({
  WEAPON: 'weapon',
  ARMOR: 'armor',
});

export const HUMANOID_SLOTS = Object.freeze([Slots.WEAPON, Slots.ARMOR]);
