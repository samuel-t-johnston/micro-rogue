import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance, cardinalDirection } from '../../world/map/geometry.js';

// How loud a shouted order is — how far it carries on top of the hearer's own range.
const SHOUT_VOLUME = 8;

/**
 * Commander goal: on first sighting a hostile, shout an enemy report — a sound carrying the compass
 * direction to the foe, stamped (by the shout action) with the commander's voice language. Other
 * creatures that share the language and hear it can converge (see `obey-shouts`).
 *
 * It tracks which enemies it has already reported (in shared memory), filtered to those still in
 * sight, so it shouts once per fresh sighting and then falls through to its combat goals. An enemy
 * that leaves sight and returns is reported again. State-based (tracking reported enemy ids) rather
 * than turn-timed, because a goal below an acting one doesn't evaluate every turn, so a per-turn
 * cooldown would fire unevenly.
 */
export const shoutEnemyReport = {
  evaluate(context) {
    const { memory, perception, selfState } = context;
    if (!memory) return null; // this goal's state lives in memory; a memoryless creature can't report

    const hostiles = perception.entities.filter(
      (o) => o.tags.isActor && areHostile(selfState.factions, o.factions),
    );
    const visibleIds = new Set(hostiles.map((h) => h.entityId));

    // Forget enemies no longer visible so a re-encounter triggers a fresh report.
    const reported = new Set((memory.reportedEnemyIds ?? []).filter((id) => visibleIds.has(id)));

    const unreported = hostiles.filter((h) => !reported.has(h.entityId));
    if (unreported.length === 0) {
      memory.reportedEnemyIds = [...reported];
      return null; // nothing new to report — fall through to combat
    }

    let target = unreported[0];
    let best = chebyshevDistance(selfState.position, target.position);
    for (const h of unreported) {
      const d = chebyshevDistance(selfState.position, h.position);
      if (d < best) {
        target = h;
        best = d;
      }
    }

    reported.add(target.entityId);
    memory.reportedEnemyIds = [...reported];

    const direction = cardinalDirection(selfState.position, target.position);
    return {
      action: { type: 'shout', volume: SHOUT_VOLUME, message: { kind: 'enemy-report', direction } },
    };
  },
};
