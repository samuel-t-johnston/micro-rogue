/**
 * @file Renders a smelled-scent percept into a player-facing log line (the smell counterpart of
 * sound-text). It's also the "what stands out" config: only profiles in SCENT_FLAVOR are noteworthy
 * enough to log — describeSmell returns null for anything else, and the player-smell goal skips it.
 * So orcs reek, but a profile we choose not to flavor (or that's surfaced through another sense, like
 * the scuttler's scrabbling) produces no smell line.
 */

const DIRECTION_WORDS = {
  N: 'north', NE: 'northeast', E: 'east', SE: 'southeast',
  S: 'south', SW: 'southwest', W: 'west', NW: 'northwest',
};

const SCENT_FLAVOR = {
  orcs: 'the stench of orcs',
};

/** Renders a smelled-scent percept into a player-facing log line, or null if the profile isn't noteworthy. */
export function describeSmell(percept) {
  const flavor = SCENT_FLAVOR[percept.profile];
  if (!flavor) return null; // not noteworthy → no log line
  const word = DIRECTION_WORDS[percept.direction];
  const suffix = word ? ` to the ${word}` : ' nearby';
  return `You smell ${flavor}${suffix}.`;
}
