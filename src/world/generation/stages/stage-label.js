/**
 * @file Labeling stage (geometry-agnostic): assigns special role labels to distinct random zones.
 * It only reads the zone set from the blackboard, so it's reusable across any dungeon geometry.
 * See docs/design/procedural-3x3-dungeon.md.
 *
 * Stage parameters (optional):
 *   labels — role labels to assign, one per distinct zone, in priority order
 *            (default ['stairs-up', 'stairs-down', 'treasure', 'item', 'item']). With fewer zones
 *            than labels, the trailing (lower-priority) labels are skipped, with a warning.
 *   fill   — a label applied to *every* zone left unassigned after `labels` (default none). Lets a
 *            big floor label all its leftover rooms in one go (e.g. fill:'item' for dense loot)
 *            without listing dozens of entries.
 *   section — restrict labeling to zones of this district id (default all). Run once per section to
 *            label the districts of a composed floor separately.
 *
 * Blackboard:
 *   level:zones — each chosen zone gets one label pushed onto its `labels` (alongside 'room').
 */
import { LEVEL_ZONES } from '../blackboard-keys.js';
import { isChamber } from '../zone-tiles.js';

const DEFAULT_LABELS = ['stairs-up', 'stairs-down', 'treasure', 'item', 'item'];

/** Runs the labeling stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const labels = stageConfig.labels ?? DEFAULT_LABELS;
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const section = stageConfig.section;

  // Roles (and the fill label) only go on chamber zones — never a passage or junction, which are
  // connective tissue, not places to put stairs, treasure, or the amulet. Restricted to `section` when
  // set, so a composed floor can label each district separately. Drawn without replacement so no zone
  // gets two roles.
  const pool = zones.filter((z) => isChamber(z) && (section == null || z.section === section));
  for (const label of labels) {
    if (pool.length === 0) {
      console.warn(`[label] ran out of zones; "${label}" not placed`);
      continue;
    }
    const [zone] = pool.splice(rng.nextInt(0, pool.length), 1);
    zone.labels.push(label);
  }

  // Every remaining zone gets the fill label (no RNG — it's all of them).
  if (stageConfig.fill) for (const zone of pool) zone.labels.push(stageConfig.fill);
}
