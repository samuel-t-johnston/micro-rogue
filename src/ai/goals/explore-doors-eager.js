import { chebyshevDistance, passableNeighbors } from '../../world/map/geometry.js';
import { findPathToAdjacent } from '../../world/map/pathfinding.js';

// Explored tiles older than this many of the creature's own turns are forgotten each evaluation, so
// the creature keeps drifting onto new ground instead of being permanently walled off from where it
// has already been.
const EXPLORED_TTL = 5;

/**
 * NPC goal: actively seek out closed doors, open them, and pass through — giving wandering creatures a
 * reason to spread through a level rather than mill about one room.
 *
 * State lives in `memory.exploreDoors` (private to this goal for now): a `targetId`/`targetPos` for the
 * door being pursued, and a list of recently `explored` tiles (each with the turn it was marked). Doors
 * are *acquired* only through perception (a creature learns a door exists by seeing it), but once a
 * target is chosen its open/closed state is read straight off the entity, so losing line of sight while
 * approaching doesn't strand the goal.
 *
 * The step ladder:
 * acquire the nearest visible closed door
 * → path to a tile beside it (a closed door is impassable, so we approach rather than route onto it)
 * → open it when adjacent
 * → mark our side and step onto the open door
 * → step off the far side away from where we came, retiring the door.
 * (Marking the near tile then the door tile "explored" is what carries the creature *through* rather
 * than back.)
 */
export const exploreDoorsEager = {
  evaluate(context) {
    const { memory, selfState, perception, level, turnCount } = context;
    if (!memory) return null;

    const state = (memory.exploreDoors ??= { explored: [] });

    // Decay stale explored tiles — always, whether or not we end up acting.
    state.explored = state.explored.filter((t) => turnCount - t.turn <= EXPLORED_TTL);

    const pos = selfState.position;

    // Resolve the current target door from its stored tile; drop it if it's gone.
    let door = state.targetId != null ? findDoorAt(level, state.targetPos, state.targetId) : null;
    if (state.targetId != null && !door) clearTarget(state);

    // Acquire: no target and a closed door is in sight -> pursue the nearest.
    if (state.targetId == null) {
      const closed = perception.entities.filter((o) => o.tags.isOpenable && o.isOpen === false);
      if (closed.length > 0) {
        const nearest = nearestByChebyshev(pos, closed);
        state.targetId = nearest.entityId;
        state.targetPos = { x: nearest.position.x, y: nearest.position.y };
        door = findDoorAt(level, state.targetPos, state.targetId);
      }
    }

    if (door) {
      const openable = door.components.get('openable');
      const dist = chebyshevDistance(pos, state.targetPos);

      if (!openable.isOpen) {
        if (dist === 1) {
          // Adjacent to a closed door -> open it.
          return { action: { type: 'interact', targetEntityId: state.targetId } };
        }
        // Far from a closed door -> approach a tile beside it (the door tile isn't passable).
        const path = findPathToAdjacent(pos, state.targetPos, level);
        if (path && path.length > 0) {
          return { action: { type: 'move', x: path[0].x, y: path[0].y } };
        }
        clearTarget(state); // unreachable — give up and let acquisition find another later
      } else if (dist === 0) {
        // Standing on the open door -> retire it and step through, away from where we came.
        markExplored(state, state.targetPos, turnCount);
        clearTarget(state);
        const away = stepAwayFrom(pos, state.explored, level);
        if (away) return { action: { type: 'move', x: away.x, y: away.y } };
      } else if (dist === 1) {
        // Adjacent to the open door -> mark our side and step onto it.
        if (level.isPassable(state.targetPos.x, state.targetPos.y)) {
          markExplored(state, pos, turnCount);
          return { action: { type: 'move', x: state.targetPos.x, y: state.targetPos.y } };
        }
        // door tile is occupied (someone's passing through) — hold and keep the target rather than
        // drift away, which would abandon the doorway next turn.
        return null;
      } else {
        // Target opened by something else while we were away -> abandon and re-acquire later.
        clearTarget(state);
      }
    }

    // No actionable door: keep drifting away from recently explored ground if we can.
    const away = stepAwayFrom(pos, state.explored, level);
    if (away) return { action: { type: 'move', x: away.x, y: away.y } };

    return null;
  },
};

function clearTarget(state) {
  delete state.targetId;
  delete state.targetPos;
}

// Resolves a stored door id back to the live entity via its tile (doors don't move). Returns null if
// nothing openable with that id is there any more.
function findDoorAt(level, targetPos, targetId) {
  if (!targetPos) return null;
  for (const e of level.getEntitiesAt(targetPos.x, targetPos.y)) {
    if (e.id === targetId && e.components.has('openable')) return e;
  }
  return null;
}

function nearestByChebyshev(pos, observations) {
  let best = observations[0];
  let bestDist = chebyshevDistance(pos, best.position);
  for (const o of observations) {
    const d = chebyshevDistance(pos, o.position);
    if (d < bestDist) {
      best = o;
      bestDist = d;
    }
  }
  return best;
}

function markExplored(state, tile, turn) {
  const existing = state.explored.find((t) => t.x === tile.x && t.y === tile.y);
  if (existing) existing.turn = turn;
  else state.explored.push({ x: tile.x, y: tile.y, turn });
}

// Picks the passable neighbor that maximizes summed distance from the explored tiles, requiring a
// strict improvement over standing still so a creature boxed against explored ground doesn't jitter.
// Returns null when no neighbor beats the current tile (or there's nothing to move away from).
function stepAwayFrom(pos, explored, level) {
  if (explored.length === 0) return null;
  const score = (x, y) => explored.reduce((sum, t) => sum + chebyshevDistance({ x, y }, t), 0);

  let best = null;
  let bestScore = score(pos.x, pos.y);
  for (const n of passableNeighbors(pos, level)) {
    const s = score(n.x, n.y);
    if (s > bestScore) {
      best = n;
      bestScore = s;
    }
  }
  return best;
}
