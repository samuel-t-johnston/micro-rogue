import { DIRECTION_STEPS } from '../../world/geometry.js';

// How many turns to keep advancing on a heard order after the sound itself has faded. Sounds decay
// in a couple of turns; this lets a heading carry the orc onward between shouts.
const HEADING_PERSISTENCE = 4;

/**
 * NPC goal: obey a shouted, understood enemy report by advancing in the reported direction. This is
 * a direction-based investigate — it only carries the creature roughly toward the foe; once it gains
 * line of sight, the higher-priority chase/attack goals take over (this goal sits below them). The
 * heading is held in memory for a few turns so the creature keeps moving between shouts; it lapses
 * on its own and is refreshed by each new understood order.
 */
export const obeyShouts = {
  evaluate(context) {
    const { memory, perception, selfState, level } = context;

    const order = (perception.sounds ?? []).find(s =>
      s.understood && s.message?.kind === 'enemy-report' && s.message.direction);
    if (order) {
      memory.heading = order.message.direction;
      memory.headingTurns = HEADING_PERSISTENCE;
    }

    if (!memory.heading || !(memory.headingTurns > 0)) {
      delete memory.heading;
      delete memory.headingTurns;
      return null;
    }

    memory.headingTurns -= 1;

    const [dx, dy] = DIRECTION_STEPS[memory.heading];
    const nx = selfState.position.x + dx;
    const ny = selfState.position.y + dy;
    if (!level.isPassable(nx, ny)) return null; // blocked this turn — let a lower goal (wander) try

    return { action: { type: 'move', x: nx, y: ny } };
  },
};
