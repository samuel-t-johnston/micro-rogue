/**
 * Builds the observation record a sight-type sense reports for a single perceived entity. Shared by
 * the FOV `vision` sense and the debug `mega-vision` sense so their observation shape can't drift.
 * Confidence is always 100 for direct sight; everything else is read off the entity's components.
 *
 * `tags.isOpenable` + `isOpen` let navigation goals reason about doors (e.g. explore-doors-eager);
 * `isOpen` is undefined for non-openable entities so consumers can distinguish "not a door" from
 * "a closed door".
 */
export function describeObservedEntity(entity, position, turnCount) {
  const openable = entity.components.get('openable');
  return {
    entityId: entity.id,
    position: { x: position.x, y: position.y },
    confidence: 100,
    turnObserved: turnCount,
    factions: entity.components.get('faction') ?? [],
    tags: {
      isPlayer: entity.components.has('playerControlled'),
      // An actor (creature) vs. inert scenery/items — lets goals ignore floor items.
      // Hostility is decided by all goals via the faction list above (see areHostile).
      isActor: entity.components.has('creature'),
      isOpenable: !!openable,
    },
    isOpen: openable ? openable.isOpen : undefined,
  };
}
