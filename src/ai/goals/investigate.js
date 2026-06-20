import { findPath } from '../../world/pathfinding.js';

// How many of the creature's own turns a cold lead survives before it gives up and forgets.
const GIVE_UP_TURNS = 8;

// NPC goal: pursue the last place a foe was perceived. The perception-memory hook writes
// `memory.lastKnownEnemy = { pos, turn, source }` whenever a hostile is seen or a non-ally noise is
// heard; this goal walks toward that tile once the trail goes cold. It sits below active pursuit
// (chase/attack/track-scent), so it only fires after the creature has actually lost the target. It
// clears the lead — falling back to wandering — on arrival (nothing there), when the lead is
// unreachable, or once it's gone stale (older than GIVE_UP_TURNS of this creature's turns).
export const investigate = {
  evaluate(context) {
    const { memory, selfState, level, turnCount } = context;
    const lead = memory?.lastKnownEnemy;
    if (!lead) return null;

    if (turnCount - lead.turn > GIVE_UP_TURNS) {
      delete memory.lastKnownEnemy;
      return null;
    }

    if (selfState.position.x === lead.pos.x && selfState.position.y === lead.pos.y) {
      delete memory.lastKnownEnemy; // arrived — nothing here
      return null;
    }

    const path = findPath(selfState.position, lead.pos, level);
    if (!path || path.length === 0) {
      delete memory.lastKnownEnemy; // unreachable
      return null;
    }

    return { action: { type: 'move', x: path[0].x, y: path[0].y } };
  },
};
