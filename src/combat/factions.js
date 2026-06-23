/**
 * Two entities are friendly if their faction lists share at least one tag, and hostile if they share
 * none. A factionless entity (empty list) shares nothing with anyone, so it reads as hostile to
 * everyone — including other factionless entities. That default is fine until a real
 * faction/relationship system introduces neutrals.
 * @returns {boolean} True if the two faction lists share no tag.
 */
export function areHostile(factionsA, factionsB) {
  const a = factionsA ?? [];
  const b = factionsB ?? [];
  return !a.some((tag) => b.includes(tag));
}
