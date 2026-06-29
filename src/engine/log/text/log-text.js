/**
 * @file Stateless helpers for building player-facing log strings. These keep the
 * "You" vs "The goblin" distinction and verb agreement in one place, so the
 * resolution sites that write display strings stay one-liners.
 *
 * Player-controlled entities read as second person ("You pick up the dagger.");
 * everything else reads as third person ("The goblin picks up the dagger.").
 * We pre-render plain strings rather than build a templating system — see
 * docs/design/dev-tools-and-logging.md.
 */

/** True if the entity is player-controlled (reads as second person in log text). */
export function isPlayer(entity) {
  return entity.components.has('playerControlled');
}

function entityName(entity) {
  return entity.components.get('name') ?? 'creature';
}

/** Sentence-initial reference to an actor: 'You' or 'The goblin'. */
export function subject(entity) {
  return isPlayer(entity) ? 'You' : `The ${entityName(entity)}`;
}

/** Mid-sentence object reference: 'you' or 'the goblin'. */
export function object(entity) {
  return isPlayer(entity) ? 'you' : `the ${entityName(entity)}`;
}

/**
 * Picks the verb form that agrees with the actor: second person for the player,
 * third-person singular for everyone else. e.g. `conjugate(actor, 'pick up', 'picks up')`.
 */
export function conjugate(entity, youForm, otherForm) {
  return isPlayer(entity) ? youForm : otherForm;
}

/** Possessive determiner agreeing with the actor: 'your' or 'its'. */
export function possessive(entity) {
  return isPlayer(entity) ? 'your' : 'its';
}

/**
 * A trailing " (N)" for a stack of more than one, else "". Appended to item names everywhere they're
 * shown (log lines, inventory, equipment, pickup labels) so quantity is always visible. A single item
 * (count 1 or no `stackable` component) gets no suffix, keeping ordinary names — and lone projectiles —
 * clean.
 */
export function quantitySuffix(item) {
  const count = item.components.get('stackable')?.count;
  return count > 1 ? ` (${count})` : '';
}

/** An item's name lowercased for mid-sentence use, with a stack quantity: "the arrow (20)". */
export function itemName(item) {
  return (item.components.get('name') ?? 'item').toLowerCase() + quantitySuffix(item);
}

/**
 * The canonical on-screen name for an entity — its name as authored (unlike the lowercased,
 * mid-sentence `itemName`) with a stack quantity appended for stacks of more than one ("Arrow (20)").
 * The single place UI lists, menus, and tile labels should render an item/entity name; `fallback`
 * names the entity when it has no `name` component. Works for any entity (a non-stackable creature or
 * door simply gets no suffix).
 */
export function displayName(entity, fallback = 'Unknown') {
  return (entity.components.get('name') ?? fallback) + quantitySuffix(entity);
}
