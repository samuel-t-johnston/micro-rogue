import { applyEffect } from '../../effects/core/effects.js';
import { isDamageable } from '../../combat/targeting.js';
import { resolveAttackDamage } from '../../combat/attack-damage.js';
import { getWeaponStats, resolveAmmo, getEquippedWeapon } from '../../combat/weapons.js';
import { traceFlight, settleProjectile, scatterTile } from '../core/projectile-flight.js';
import { rollsMiss } from '../../combat/accuracy.js';
import { splitStack } from '../../world/entities/stacking.js';
import { chebyshevDistance, cardinalDirection } from '../../world/map/geometry.js';
import { gameLog } from '../../engine/log/game-log.js';
import { animations } from '../../render/animations.js';
import {
  subject,
  object,
  conjugate,
  possessive,
  itemName,
} from '../../engine/log/text/log-text.js';
import { emitSound } from '../../world/sense-systems/sounds.js';

// Logs the hit, emits a faction-neutral combat sound, and applies the damage effect to `struck`. The
// log line is written before applyEffect because the damage effect may route the target through death
// (which clears its components) and we still want its name/pronoun here; the death line is logged
// separately by handleDeath. A clash is audible to out-of-sight creatures — sourceFactions left empty
// (see emitSound) so no hearer dismisses a fight as "just an ally".
function dealDamage(actor, struck, amount, level, registry) {
  gameLog.add({
    actor: actor.id,
    action: 'attack',
    target: struck.id,
    damage: amount,
    display: `${subject(actor)} ${conjugate(actor, 'hit', 'hits')} ${object(struck)} for ${amount} damage.`,
  });
  const actorPos = actor.components.get('position');
  if (actorPos) {
    emitSound(registry, level, {
      sourceId: actor.id,
      x: actorPos.x,
      y: actorPos.y,
      volume: 6,
      message: { kind: 'combat' },
    });
  }
  applyEffect('damage', actor, struck, { amount }, level, registry);
}

// A melee swing at an adjacent target: damage with a cosmetic lunge, no ammunition, no flight. This is
// the unchanged original attack path; it does not require the actor to have a position (the wiggle and
// the combat sound are each guarded), so a bare attacker still deals damage.
function meleeAttack(actor, target, level, registry) {
  const amount = resolveAttackDamage(actor, { isRanged: false }); // a swing: STR-scaled, no ammo
  const targetPos = target.components.get('position');
  if (targetPos) animations.wiggle(actor, { x: targetPos.x, y: targetPos.y });
  dealDamage(actor, target, amount, level, registry);
  return false;
}

// Plays the aimed attack animation: a flying projectile for a ranged shot (bow/javelin), or an
// out-and-back thrust for a reach weapon (spear). The directional sprite comes from the ammo for an
// external-ammo weapon (the bow stays in hand, so the arrow flies) and from the weapon itself
// otherwise (javelin, spear); it's keyed by the 8-way compass bearing to the target. When no such
// sprite is defined (the default until art is added), it falls back to the melee wiggle so the attack
// still reads on screen. Purely cosmetic — game state has already resolved.
function animateAttack(actor, actorPos, targetPos, impact, weapon, projectile) {
  const usesAmmoSprite = weapon.ammoType != null && weapon.ammoType !== 'self';
  const dir = cardinalDirection(actorPos, targetPos);
  const spriteMap = usesAmmoSprite
    ? projectile?.components.get('ammunition')?.attackSprites
    : weapon.attackSprites;
  const spriteName = dir ? spriteMap?.[dir] : null;

  if (!spriteName) {
    animations.wiggle(actor, { x: targetPos.x, y: targetPos.y });
    return;
  }

  // The flying entity's base renderable supplies the glyph-mode/colour fallback; a reach weapon has no
  // projectile, so its still-equipped weapon does.
  const base = (projectile ?? getEquippedWeapon(actor))?.components.get('renderable');
  const renderable = {
    sprite: spriteName,
    color: base?.color ?? '#101010',
    glyph: base?.glyph ?? '*',
    glyphColor: base?.glyphColor ?? '#ffffff',
  };

  // Thrust vs. one-way flight is inferred from ammoType (no ammo = a reach weapon that retracts). This
  // is the one animation decision not independently selectable per weapon; the seam for that is an
  // optional weapon.flightStyle field defaulting from ammoType (see docs/design/ranged-weapons.md §9).
  if (weapon.ammoType == null) {
    animations.thrust({ from: actorPos, to: targetPos, renderable });
  } else {
    animations.projectile({ from: actorPos, to: impact, renderable });
  }
}

// Removes one unit of ammunition from the actor. Returns `{ projectile, depleted }` — the single item
// that flies, and whether it was the last of the stack (the caller logs that and the slot is cleared).
// When the whole stack is taken splitStack returns the stack entity itself; otherwise a fresh count-1
// clone flies and the source stack stays equipped with the rest.
function consumeOneProjectile(actor, ammo, registry) {
  const projectile = splitStack(ammo.stack, 1, registry);
  const depleted = projectile === ammo.stack;
  if (depleted) {
    const wears = actor.components.get('wearsEquipment');
    if (wears) wears.slots[ammo.slot] = null;
  }
  return { projectile, depleted };
}

// A failed attack — a misfire (no usable ammo) or a target out of range — is a *free* action only for
// the player: a discoverability affordance so a wasted shot doesn't burn the turn and they can choose
// again. For an NPC it must consume the turn. A goal re-proposes the same impossible attack every
// evaluation, and a free action re-runs the entity's turn immediately (see turn-manager), so a free
// failure would spin into an infinite loop. (Ranged NPCs also stow a dry weapon via equip-weapon, which
// keeps them off this path entirely; this is the belt-and-suspenders guard for any that don't.)
const freeOnFailedAttack = (actor) => actor.components.has('playerControlled');

/**
 * A reach or ranged attack on a target beyond melee but within weapon range. A weapon with no ammoType
 * (a reach weapon, e.g. the spear) deals damage along a clear line with nothing leaving the hand. An
 * ammo-using weapon (bow → arrows, javelin → itself) consumes one unit, which flies as a projectile and
 * lands or breaks on impact (shared with throwing). When the actor has no usable ammunition it misfires:
 * a logged message and — for the player — a free action (the turn is not spent), so a failed shot
 * doesn't punish them; an NPC's misfire consumes the turn (see freeOnFailedAttack).
 * @returns {boolean} `false` (turn consumed) on a resolved attack or an NPC misfire; `true` (free) only
 *   on a player misfire.
 */
function projectileAttack(actor, target, actorPos, targetPos, weapon, level, registry) {
  // A strike is "ranged" (DEX-scaled, and it can miss) exactly when it spends ammunition — a bow shot
  // or a thrown javelin; a reach weapon (spear, ammoType null) fights in melee (STR) even out at
  // distance. Resolved before consuming ammo: a self-thrown weapon (javelin) clears the weapon slot when
  // its last unit flies, which would otherwise drop its attack modifier from the resolved total.
  const isRanged = weapon.ammoType != null;
  const amount = resolveAttackDamage(actor, { isRanged });

  let projectile = null;
  let usedLastName = null;
  if (weapon.ammoType != null) {
    const ammo = resolveAmmo(actor, weapon.ammoType);
    if (!ammo) {
      gameLog.add({
        actor: actor.id,
        action: 'attack',
        display: `${subject(actor)} ${conjugate(actor, 'have', 'has')} no ${weapon.ammoType}s.`,
      });
      return freeOnFailedAttack(actor); // free for the player; consumes an NPC's turn (no retry loop)
    }
    const consumed = consumeOneProjectile(actor, ammo, registry);
    projectile = consumed.projectile;
    // Captured before a break can clear the entity's name, logged after the attack resolves.
    if (consumed.depleted) usedLastName = itemName(projectile);
  }

  // A ranged shot can go wide (DEX + range; melee/reach never rolls). A miss veers to a tile beside the
  // target — which may clip a bystander standing there — falling back to a straight shot if the target
  // is boxed in. The flight, impact, and animation then resolve toward the (possibly redirected) tile.
  let aim = targetPos;
  let missed = false;
  if (isRanged && rollsMiss(actor, chebyshevDistance(actorPos, targetPos))) {
    const scatter = scatterTile(level, actorPos, targetPos);
    if (scatter) {
      aim = scatter;
      missed = true;
    }
  }
  const { impact, before } = traceFlight(level, actorPos.x, actorPos.y, aim.x, aim.y);
  const struck = [...level.getEntitiesAt(impact.x, impact.y)].find(isDamageable);

  animateAttack(actor, actorPos, aim, impact, weapon, projectile);

  // Announce the miss before whatever the stray shot goes on to do (clatter, or clip a bystander).
  if (missed) {
    gameLog.add({
      actor: actor.id,
      action: 'attack',
      display: `${subject(actor)} ${conjugate(actor, 'miss', 'misses')} ${possessive(actor)} target.`,
    });
  }

  if (struck) {
    dealDamage(actor, struck, amount, level, registry);
  } else if (projectile) {
    // The shot met no target (a blocked line, or the foe gone) — narrate the stray projectile.
    gameLog.add({
      actor: actor.id,
      action: 'attack',
      display: `The ${itemName(projectile)} clatters away.`,
    });
  }

  if (projectile) {
    const breakChance =
      projectile.components.get('ammunition')?.breakChance ??
      projectile.components.get('weapon')?.breakChance ??
      0;
    settleProjectile(projectile, { impact, before, breakChance }, level, registry);
  }

  if (usedLastName) {
    gameLog.add({
      actor: actor.id,
      action: 'attack',
      display: `${subject(actor)} ${conjugate(actor, 'use', 'uses')} ${possessive(actor)} last ${usedLastName}.`,
    });
  }

  return false;
}

/**
 * Attacks the target entity. Branches on the actor's equipped weapon and the distance to the target:
 * a melee swing within meleeRange, otherwise a reach/ranged attack out to the weapon's range (see
 * projectileAttack). Damage is resolveAttackDamage: the `attack` score (unarmed base + worn modifiers)
 * plus half the governing ability (STR melee, DEX ranged), floored, min 1 (see attack-damage.js).
 * @returns {boolean} `false` when the turn is consumed (the normal case, including a swing at a target
 *   that died before resolution, and any failed attack by an NPC); `true` only when the *player* misses
 *   on no ammo or an out-of-range target — a free affordance that doesn't spend their turn.
 */
export function executeAttack(actor, action, level, registry) {
  const target = registry.getEntity(action.targetEntityId);
  if (!target || !isDamageable(target)) return false;

  const weapon = getWeaponStats(actor);
  const actorPos = actor.components.get('position');
  const targetPos = target.components.get('position');
  // No positions (a degenerate but tolerated state) reads as adjacent, preserving the melee path.
  const distance = actorPos && targetPos ? chebyshevDistance(actorPos, targetPos) : 0;

  if (distance <= weapon.meleeRange) return meleeAttack(actor, target, level, registry);
  // Out of range: an impossible attack (the tile resolver gates the player; NPC goals gate
  // themselves). A free no-op for the player; an NPC spends the turn rather than retry-looping.
  if (distance > weapon.range) return freeOnFailedAttack(actor);

  return projectileAttack(actor, target, actorPos, targetPos, weapon, level, registry);
}
