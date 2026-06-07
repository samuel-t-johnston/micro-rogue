import { playerAutoMove } from './player-auto-move.js';
import { playerAutoPickup } from './player-auto-pickup.js';
import { playerGetInput } from './player-get-input.js';
import { wanderAimlessly } from './wander-aimlessly.js';

// Maps the string keys stored in an entity's `ai` component to goal implementations.
// The `ai` component holds names (not function references) so it serializes cleanly;
// goals are resolved here at evaluation time. Add new goals to this map.
const goals = {
  'player-auto-move': playerAutoMove,     // Player goal: auto-move toward a target tile
  'player-auto-pickup': playerAutoPickup, // Player goal: auto-pickup items on the current tile
  'player-get-input': playerGetInput,     // Player goal: wait for player input and execute it
  'wander-aimlessly': wanderAimlessly,    // NPC goal: pick a random adjacent tile and move there
};

// Resolves an ordered list of goal names to goal objects, preserving order (= priority).
export function resolveGoals(names) {
  return names.map(name => {
    const goal = goals[name];
    if (!goal) throw new Error(`Unknown goal: "${name}"`);
    return goal;
  });
}
