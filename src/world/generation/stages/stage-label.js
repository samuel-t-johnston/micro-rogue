// Labeling stage (geometry-agnostic): assigns special role labels to distinct random zones.
// It only reads the zone set from the blackboard, so it's reusable across any dungeon geometry.
// See docs/design/procedural-3x3-dungeon.md.
//
// Stage parameters (optional):
//   labels — role labels to assign, one per distinct zone, in priority order
//            (default ['stairs-up', 'stairs-down', 'treasure', 'item', 'item']). With fewer zones
//            than labels, the trailing (lower-priority) labels are skipped, with a warning.
//
// Blackboard:
//   level:zones — each chosen zone gets one label pushed onto its `labels` (alongside 'room').

const DEFAULT_LABELS = ['stairs-up', 'stairs-down', 'treasure', 'item', 'item'];

export function run(level, stageConfig = {}, blackboard, rng) {
  const labels = stageConfig.labels ?? DEFAULT_LABELS;
  const zones = blackboard['level:zones'] ?? [];

  // Assign each label to a distinct zone, drawn without replacement so no zone gets two roles.
  const pool = [...zones];
  for (const label of labels) {
    if (pool.length === 0) {
      console.warn(`[label] ran out of zones; "${label}" not placed`);
      continue;
    }
    const [zone] = pool.splice(rng.nextInt(0, pool.length), 1);
    zone.labels.push(label);
  }
}
