/**
 * @file Weapon capability resolver — the single place that answers "what can this actor do with its
 * equipped weapon": its range, the melee/ranged threshold, and which ammunition (if any) a ranged
 * attack consumes. Derived on demand from the equipped items, never cached (mirrors the attribute
 * resolver in src/attributes/attributes.js).
 *
 * Tolerates absent data so old saves and hand-built entities never crash: an entity with no weapon —
 * or a weapon-slot item that predates the `weapon` component — reads as unarmed (range 1, melee only),
 * and a stack with no `stackable` component counts as one. See docs/design/ranged-weapons.md.
 */
import { Slots } from '../../data/equipment-slots.js';

// The fallback weapon profile: a plain melee swing at adjacent range that consumes nothing. Returned
// for unarmed creatures and for any weapon-slot item lacking a `weapon` component, and used to fill
// fields absent from a partial (old) weapon component.
const UNARMED = Object.freeze({
  range: 1,
  meleeRange: 1,
  ammoType: null,
  breakChance: 0,
  attackSprites: {},
});

/** The item entity in the actor's weapon slot, or null when unarmed / it wears no equipment. */
export function getEquippedWeapon(entity) {
  return entity.components.get('wearsEquipment')?.slots[Slots.WEAPON] ?? null;
}

/**
 * The actor's effective weapon stats. Reads the equipped weapon's `weapon` component, filling any
 * absent field from the unarmed profile; falls back entirely to unarmed when no weapon is equipped or
 * the equipped item carries no `weapon` component. The result is a fresh object (with a copied
 * `attackSprites`) so callers can't mutate the stored component.
 */
export function getWeaponStats(entity) {
  const w = getEquippedWeapon(entity)?.components.get('weapon');
  if (!w) return { ...UNARMED };
  return { ...UNARMED, ...w, attackSprites: { ...w.attackSprites } };
}

/**
 * The minimal capability object the tile-action resolver needs to decide whether a target is
 * attackable (see resolveTileActions): `{ range, meleeRange }`. Deliberately small so callers don't
 * bind to weapon internals and it can grow without churn.
 */
export function getAttackCapability(entity) {
  const { range, meleeRange } = getWeaponStats(entity);
  return { range, meleeRange };
}

/**
 * Finds the ammunition a ranged attack would consume, for a weapon whose `ammoType` is non-null:
 *   - 'self'  → the equipped weapon stack itself (a self-thrown weapon like the javelin); always
 *               available, since you're holding it.
 *   - other   → the item in the ammunition slot, only if its `ammunition.ammoType` matches.
 * Returns `{ stack, slot }` — the entity to consume one unit from and the equipment slot it occupies
 * (so the caller can clear that slot when the stack empties) — or `null` when no usable ammo exists
 * (missing quiver, wrong type, or empty), which the attack handler turns into a misfire message.
 * `ammoType === null` (no ammo needed) returns null too; callers gate on ammoType before calling.
 */
export function resolveAmmo(entity, ammoType) {
  if (ammoType == null) return null;

  if (ammoType === 'self') {
    const weapon = getEquippedWeapon(entity);
    return weapon ? { stack: weapon, slot: Slots.WEAPON } : null;
  }

  const ammo = entity.components.get('wearsEquipment')?.slots[Slots.AMMUNITION] ?? null;
  if (!ammo) return null;
  if (ammo.components.get('ammunition')?.ammoType !== ammoType) return null;
  const count = ammo.components.get('stackable')?.count ?? 1;
  if (count <= 0) return null;
  return { stack: ammo, slot: Slots.AMMUNITION };
}
