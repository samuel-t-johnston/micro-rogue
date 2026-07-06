import { applyEffect } from '../../effects/core/effects.js';
import { traceFlight, settleProjectile, scatterTile } from '../core/projectile-flight.js';
import { rollsMiss } from '../../combat/accuracy.js';
import { chebyshevDistance } from '../../world/map/geometry.js';
import { animations } from '../../render/animations.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, object, conjugate, possessive, itemName } from '../../engine/log/text/log-text.js';

// Joins names into a readable list: "a", "a and b", "a, b and c".
function joinNames(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Throws an item from the actor's inventory toward a target tile. The throw may go wide (accuracy.js) —
 * a miss veers to a tile beside the aim — after which the item flies in a straight line and hits the
 * first thing that stops it: a wall, fixture, or creature, possibly short of where it was aimed. Any
 * item can be thrown; only one with a `throwable` component carries
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
  // A throw can go wide (thrower DEX + range, same roll as a bow). A miss veers to a tile beside the
  // aimed one — which may clip a bystander standing there — or hits home if the target is boxed in.
  const aimed = { x: action.x, y: action.y };
  let aim = aimed;
  let missed = false;
  if (rollsMiss(actor, chebyshevDistance(origin, aimed))) {
    const scatter = scatterTile(level, origin, aimed);
    if (scatter) {
      aim = scatter;
      missed = true;
    }
  }
  const { impact, before } = traceFlight(level, origin.x, origin.y, aim.x, aim.y);
  const throwable = item.components.get('throwable');
  const itemId = item.id;
  const thrownName = itemName(item); // captured before a lethal hit / break can clear components

  // Fly the item to its impact tile, using its plain (non-directional) sprite. Snapshotted now because
  // a break destroys the item before the frame draws. Purely cosmetic — the throw already resolved.
  const r = item.components.get('renderable');
  if (r) {
    animations.projectile({
      from: origin,
      to: impact,
      renderable: { sprite: r.sprite, color: r.color, glyph: r.glyph, glyphColor: r.glyphColor },
    });
  }

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

  // An item without a throwable component cannot break (breakChance: null skips the roll); one with
  // throwable breaks per its breakChance, else lands on the impact tile or bounces back to the last
  // clear tile so it never strands inside a wall, boulder, or chest.
  const broke = settleProjectile(
    item,
    { impact, before, breakChance: throwable ? throwable.breakChance : null },
    level,
    registry,
  );

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
  // A wide throw announces the miss before the impact line (which then narrates where it actually went).
  if (missed) {
    gameLog.add({
      actor: actor.id,
      action: 'throw',
      display: `${subject(actor)} ${conjugate(actor, 'miss', 'misses')} ${possessive(actor)} target.`,
    });
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
