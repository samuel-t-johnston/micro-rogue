import { playerAutoMove } from './player-auto-move.js';
import { playerAutoPickup } from './player-auto-pickup.js';
import { playerHear } from './player-hear.js';
import { playerGetInput } from './player-get-input.js';
import { wanderAimlessly } from './wander-aimlessly.js';
import { attackAdjacent } from './attack-adjacent.js';
import { fleeFromOthers } from './flee-from-others.js';
import { chaseOthers } from './chase-others.js';
import { shoutEnemyReport } from './shout-enemy-report.js';
import { obeyShouts } from './obey-shouts.js';
import { trackScent } from './track-scent.js';
import { playerSmell } from './player-smell.js';
import { investigate } from './investigate.js';

// Maps the string keys stored in an entity's `ai` component to goal implementations.
// The `ai` component holds names (not function references) so it serializes cleanly;
// goals are resolved here at evaluation time. Add new goals to this map.
const goals = {
  'player-auto-move': playerAutoMove, // Player goal: auto-move toward a target tile
  'player-auto-pickup': playerAutoPickup, // Player goal: auto-pickup items on the current tile
  'player-hear': playerHear, // Player goal: log heard sounds (side effect, never acts)
  'player-smell': playerSmell, // Player goal: log notable smells (side effect, never acts)
  'player-get-input': playerGetInput, // Player goal: wait for player input and execute it
  'wander-aimlessly': wanderAimlessly, // NPC goal: pick a random adjacent tile and move there
  'attack-adjacent': attackAdjacent, // NPC goal: attack a hostile actor in an adjacent tile
  'flee-from-others': fleeFromOthers, // NPC goal: move away from the nearest hostile actor
  'chase-others': chaseOthers, // NPC goal: move toward the nearest hostile actor
  'shout-enemy-report': shoutEnemyReport, // NPC goal: shout the direction of a newly-seen hostile
  'obey-shouts': obeyShouts, // NPC goal: advance toward an understood shouted order
  'track-scent': trackScent, // NPC goal: follow the strongest hostile scent gradient
  investigate: investigate, // NPC goal: pursue the last place a foe was perceived
};

/**
 * Resolves an ordered list of goal names to goal objects, preserving order (= priority). Throws on
 * an unknown name.
 * @param {string[]} names
 * @returns {object[]} The resolved goal objects (see the `Goal` typedef in goal-evaluator.js).
 */
export function resolveGoals(names) {
  return names.map((name) => {
    const goal = goals[name];
    if (!goal) throw new Error(`Unknown goal: "${name}"`);
    return goal;
  });
}
