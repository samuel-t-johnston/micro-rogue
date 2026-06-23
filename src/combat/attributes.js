/**
 * @file Attribute resolver: the single place that computes an entity's effective stats.
 * Stats are DERIVED on demand, never cached or mutated on equip/unequip — the total is
 * the base value plus contributions from worn equipment (attributeModifiers). Because
 * nothing is stored, there is no bonus to "remember to remove" when gear comes off, an
 * item is destroyed, or the owner dies: the next read simply doesn't see it.
 */

/** Canonical attribute names — keys into base components and equipment `attributeModifiers`. */
export const Attributes = Object.freeze({
  ATTACK_DAMAGE: 'attackDamage',
  HP: 'HP',
});

// Base value per attribute, read from the owning component. attackDamage comes from the
// attacker component (unarmed base); HP is the entity's max HP from the health component.
const BASE = {
  attackDamage: entity => entity.components.get('attacker')?.damage ?? 0,
  HP:           entity => entity.components.get('health')?.max ?? 0,
};

/**
 * Returns the entity's effective value for `attribute`: base + sum of worn-equipment modifiers. For
 * HP this is the effective max; the stored health.current is separate and is not clamped here (no
 * item currently grants +HP, so no clamp policy is owed yet).
 * @param {object} entity
 * @param {string} attribute - One of the `Attributes` values.
 * @returns {number}
 */
export function getAttribute(entity, attribute) {
  let total = (BASE[attribute] ?? (() => 0))(entity);
  const wears = entity.components.get('wearsEquipment');
  for (const item of Object.values(wears?.slots ?? {})) {
    total += item?.components.get('attributeModifiers')?.[attribute] ?? 0;
  }
  return total;
}
