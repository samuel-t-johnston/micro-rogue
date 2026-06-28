import { applyEffect } from '../../effects/core/effects.js';
import { rng } from '../../engine/core/rng.js';
import { components } from '../../world/entities/components.js';
import { getTileType } from '../../world/map/tile-registry.js';
import { lineTiles } from '../../world/map/geometry.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, object, conjugate, itemName } from '../../engine/log/text/log-text.js';

// Joins names into a readable list: "a", "a and b", "a, b and c".
function joinNames(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// True if a tile stops a thrown item's flight: solid terrain (a wall) or any entity that blocks
// movement — a fixture (boulder, chest, closed door) or a creature, all of which the item slams into.
function stopsFlight(level, x, y) {
  const tileId = level.getTile(x, y);
  if (!tileId || getTileType(tileId).blocksMovement) return true;
  for (const e of level.getEntitiesAt(x, y)) {
    if (e.components.has('blocksMovement')) return true;
  }
  return false;
}

// True if a dropped item can come to rest on a tile (and be retrieved later). Solid terrain and solid
// fixtures fill the tile and reject it; a creature does not — the item lands at its feet, recoverable
// once the creature moves or dies. This is `blocksMovement` minus the `creature` exception, derived
// rather than tracked as its own component (see docs/howto/item.md).
function tileHoldsItem(level, x, y) {
  const tileId = level.getTile(x, y);
  if (!tileId || getTileType(tileId).blocksMovement) return false;
  for (const e of level.getEntitiesAt(x, y)) {
    if (e.components.has('blocksMovement') && !e.components.has('creature')) return false;
  }
  return true;
}

// Places a thrown item that didn't break onto the map at the resting tile, so it can be retrieved
// (mirrors executeDrop's placement). The item already left the actor's inventory.
function landItem(item, x, y, level, registry) {
  item.components.get('item').location = { type: 'map' };
  if (item.components.has('position')) {
    const p = item.components.get('position');
    p.x = x;
    p.y = y;
  } else {
    registry.addComponent(item, 'position', components.position(x, y));
  }
  level.placeEntity(item);
}

/**
 * Traces a thrown item's straight-line flight from the actor's tile toward (tx, ty). Returns the
 * `impact` tile — the first tile along the line that stops the item (a wall, fixture, or creature), or
 * the target if the line is clear — and `before`, the last clear tile the item passed (the fallback
 * resting spot when the impact tile can't hold it). `before` defaults to the actor's own tile, so an
 * item thrown straight into an adjacent obstacle drops at the thrower's feet.
 */
function traceFlight(level, ox, oy, tx, ty) {
  const path = lineTiles(ox, oy, tx, ty);
  let before = path[0]; // the actor's tile
  for (let i = 1; i < path.length; i++) {
    const tile = path[i];
    if (stopsFlight(level, tile.x, tile.y)) return { impact: tile, before };
    before = tile;
  }
  return { impact: path[path.length - 1], before };
}

/**
 * Throws an item from the actor's inventory toward a target tile. The item flies in a straight line and
 * hits the first thing that stops it — a wall, fixture, or creature — which may be short of the aimed
 * tile (no miss model otherwise). Any item can be thrown; only one with a `throwable` component carries
 * an on-hit effect, applied to each non-item entity on the impact tile that can receive it (e.g.
 * damage/heal need `health`). The item then shatters (per `breakChance`) or comes to rest — on the
 * impact tile if it can hold it, otherwise bouncing back to the last clear tile.
 * @returns {boolean} `false` (turn consumed) once a throw resolves; `true` (free) if the item is gone.
 */
export function executeThrow(actor, action, level, registry) {
  const inventory = actor.components.get('inventory');
  const item = inventory?.items.find((e) => e.id === action.itemEntityId);
  if (!item) return true; // nothing to throw (shouldn't happen via the UI) — free no-op

  const idx = inventory.items.indexOf(item);
  inventory.items.splice(idx, 1);

  const origin = actor.components.get('position');
  const { impact, before } = traceFlight(level, origin.x, origin.y, action.x, action.y);
  const throwable = item.components.get('throwable');
  const itemId = item.id;
  const thrownName = itemName(item); // captured before a lethal hit / break can clear components

  // Candidates on the impact tile we can hit — creatures/doors/chests, not loose floor items. Capture
  // their names up front: a lethal hit clears the target's name component (see executeAttack).
  const targetInfos = [...level.getEntitiesAt(impact.x, impact.y)]
    .filter((e) => !e.components.has('item'))
    .map((e) => ({ entity: e, name: object(e) }));

  const affected = [];
  if (throwable) {
    for (const info of targetInfos) {
      const result = applyEffect(
        throwable.effectType,
        actor,
        info.entity,
        throwable.params,
        level,
        registry,
      );
      if (result.applied) affected.push({ name: info.name, reaction: result.reaction });
    }
  }

  const broke = throwable ? rng.random() < throwable.breakChance : false;
  if (broke) {
    registry.destroyEntity(item);
  } else {
    // Rest on the impact tile if it can hold the item (floor, open door, a creature's feet); otherwise
    // it bounces back to the last clear tile so it never strands inside a wall, boulder, or chest.
    const rest = tileHoldsItem(level, impact.x, impact.y) ? impact : before;
    landItem(item, rest.x, rest.y, level, registry);
  }

  // Impact line, item-subject. Mention the affected; if none landed, name an unaffected one we hit;
  // if the tile was empty, just narrate the throw / shatter.
  const breakSuffix = broke ? ' and breaks' : '';
  let impactLine;
  if (affected.length > 0) {
    impactLine = `The ${thrownName} hits ${joinNames(affected.map((a) => a.name))}${breakSuffix}.`;
  } else if (targetInfos.length > 0) {
    impactLine = `The ${thrownName} hits ${targetInfos[0].name}${breakSuffix}.`;
  } else {
    impactLine = broke
      ? `The ${thrownName} shatters on the floor.`
      : `${subject(actor)} ${conjugate(actor, 'throw', 'throws')} the ${thrownName}.`;
  }
  gameLog.add({ actor: actor.id, action: 'throw', item: itemId, display: impactLine });

  // Effect-specific flavor, one line per affected entity ("The orc looks hurt.").
  for (const a of affected) {
    gameLog.add({
      actor: actor.id,
      action: 'throw',
      display: capitalize(`${a.name} ${a.reaction}.`),
    });
  }

  return false;
}
