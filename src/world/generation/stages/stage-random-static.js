/**
 * @file Structure stage: seeded selection from a set of fixed layouts ("static choice"). Picks one of
 * the `layouts` via the generation RNG, then loads it exactly like the `static` stage — same tiles +
 * authored-entities handoff. See docs/howto/static-map-layouts.md and docs/design/map-generation.md.
 */
import { loadStaticLayout } from '../static-layout.js';
import { STATIC_ENTITIES, STATIC_LAYOUT } from '../blackboard-keys.js';

/** Runs the randomStatic structure stage (see the file overview). */
export async function run(level, stageConfig, blackboard, rng) {
  const layouts = stageConfig.layouts ?? [];
  if (layouts.length === 0)
    throw new Error('randomStatic stage requires a non-empty `layouts` array');
  const layout = rng.pick(layouts);
  blackboard[STATIC_LAYOUT] = layout;
  blackboard[STATIC_ENTITIES] = await loadStaticLayout(layout, level, stageConfig.importLayout);
}
