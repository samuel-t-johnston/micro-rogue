/**
 * @file Scent flavor: the player-facing phrase for each smellable scent `profile`. Content, read by
 * structure by describeSmell (src/engine/log/text/smell-text.js). This table also decides what's
 * noteworthy enough to log — a profile absent here produces no smell line (describeSmell returns null),
 * so it's surfaced through another sense or not at all. A fork adds a scent by adding an entry here.
 */
export const SCENT_FLAVOR = {
  orcs: 'the stench of orcs',
};
