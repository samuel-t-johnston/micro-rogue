import { chebyshevDistance, cardinalDirection } from '../../world/map/geometry.js';

/**
 * Creates the hearing sense. Unlike vision, it reports no entities and no visible tiles — it surfaces
 * *sounds*: located, decaying noise percepts into the SenseResult's `sounds` channel (merged into
 * context.perception.sounds). A percept is an imprecise lead — a compass direction and the sound's
 * structured message — never an exact position or an entity sighting. Goals turn understood messages
 * into behaviour (e.g. obey a shouted order); the player UI turns them into "you hear …" lines.
 *
 * Acuity (range) comes from the hearer's `hearing` component; a sound carries `volume`. The sound is
 * audible when distance <= range + volume. v1 uses straight-line (Chebyshev) distance with no
 * occlusion — walking-distance propagation and muffling (walls block, doors leak) is a planned
 * upgrade that changes only this function, not the SenseResult contract.
 */
export function createHearingSense() {
  return function hearing(entity, level, turnCount) {
    const pos = entity.components.get('position');
    const range = entity.components.get('hearing')?.range ?? 0;
    const known = new Set(entity.components.get('knownLanguages') ?? []);

    const sounds = [];
    if (pos) {
      for (const e of level.entities) {
        const snd = e.components.get('sound');
        if (!snd) continue;
        if (snd.sourceId === entity.id) continue; // never hear your own noise

        const sPos = e.components.get('position');
        if (!sPos) continue;

        const distance = chebyshevDistance(pos, sPos);
        const reach = range + snd.volume;
        if (distance > reach) continue;

        sounds.push({
          soundId: e.id,
          position: { x: sPos.x, y: sPos.y }, // the sound's origin tile (exact); the AI uses only the imprecise direction
          sourceId: snd.sourceId,
          sourceFactions: snd.sourceFactions ?? [],
          message: snd.message,
          language: snd.language,
          // Non-verbal sounds (no language) are inherently "understood" as what they are; a
          // vocalization is understood only if the hearer knows its language.
          understood: snd.language == null || known.has(snd.language),
          perceivedDirection: cardinalDirection(pos, sPos),
          distance,
          // Fades with distance within reach; kept below vision's 100 so a heard-but-unseen thing
          // never outranks a confirmed sighting. Informational only — hearing reports no entities.
          confidence: reach <= 0 ? 1 : Math.max(1, Math.round(100 * (1 - distance / (reach + 1)))),
          turnObserved: turnCount,
        });
      }
    }

    return { entities: [], visibleTiles: new Set(), sounds };
  };
}
