/**
 * @file Food — the read side of the `food` tag: identifying which carried items are edible and picking
 * which to eat first for the HUD's "easy eat" affordance (see src/ui/widgets/hud.js and the game
 * scene). This is inventory *selection*; the hunger pool it feeds and the eat/starve messages live in
 * hunger.js. Nutrition is read off the consumable's satiate amount, so the `food` tag stays the single
 * thing that says "this is a meal" while the amount stays a single source of truth.
 */

/** The satiation an edible restores — its consumable satiate amount, or 0 if it somehow carries none. */
function nutrition(item) {
  return item.components.get('consumable')?.params.amount ?? 0;
}

/**
 * The carried food to eat first for "easy eat": the one restoring the LEAST satiation, so the player
 * burns through snacks before hearty meals. Ties keep the earlier inventory item (strict `<`). Returns
 * null when the player carries no food; `player` may be null.
 */
export function selectEasyEatFood(player) {
  const items = player?.components.get('inventory')?.items ?? [];
  let best = null;
  for (const item of items) {
    if (!item.components.has('food')) continue;
    if (best === null || nutrition(item) < nutrition(best)) best = item;
  }
  return best;
}
