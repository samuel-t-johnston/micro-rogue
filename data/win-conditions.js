/**
 * @file The shipped win conditions, as content. Each entry names a "carry a quest item to a dungeon
 * exit" victory (the escapeWithQuestItem shape): `questItemId` is the item the player must be holding,
 * `message` is shown on the results screen, and `name` keys the registry. The game scene reads this
 * list and registers each via the engine's escapeWithQuestItem factory — the mechanism stays in
 * engine, the roster of victories lives here. A fork adds a win condition by adding an entry.
 */
export const WIN_CONDITIONS = [
  {
    name: 'escape-with-amulet',
    questItemId: 'amulet-of-yendor',
    message: 'You escaped the dungeon with the Amulet of Yendor!',
  },
];
