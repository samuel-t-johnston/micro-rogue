#!/usr/bin/env node
// Dev-only generation visualizer. Runs a pipeline over N seeds and writes a self-contained HTML page:
// a responsive grid of the resulting maps, districts tinted and entities drawn as their game glyphs.
// Headless — pulls in only the level-building code, no game runtime. It shares its renderer
// (`levelToHtml`) with the map-gen dev page, so the two can never drift; see
// docs/howto/visualizing-generation.md.
//
// Usage:  node scripts/visualize-generation.mjs [pipelineId] [seeds] [outPath]
//   pipelineId  a pipeline in data/pipelines/ (default 'composite')
//   seeds       how many maps to generate; map i uses seed i (default 4)
//   outPath     HTML output (default mapgen-<pipelineId>.html, gitignored)
import { writeFileSync } from 'node:fs';
import { runPipeline } from '../src/world/generation/pipeline.js';
import { createEntityRegistry } from '../src/engine/core/entity-component-system.js';
import { createRng } from '../src/engine/core/rng.js';
import {
  levelToHtml,
  mapLegendHtml,
  renderMapsDocument,
} from '../src/world/generation/visualize.js';

const pipelineId = process.argv[2] ?? 'composite';
const count = Number(process.argv[3] ?? 4);
const outPath = process.argv[4] ?? `mapgen-${pipelineId}.html`;

const mod = await import(new URL(`../data/pipelines/${pipelineId}.js`, import.meta.url)).catch(
  () => {
    throw new Error(`No pipeline "${pipelineId}" in data/pipelines/`);
  },
);
const pipeline = mod.default;
if (!pipeline?.stages)
  throw new Error(`data/pipelines/${pipelineId}.js has no default pipeline export`);

const panels = [];
let legend = '';
for (let seed = 1; seed <= count; seed++) {
  const registry = createEntityRegistry();
  const level = await runPipeline(pipeline, createRng(seed), registry);
  const creatures = registry.getEntitiesWith('ai').length;
  const items = registry.getEntitiesWith('item').length;
  panels.push({
    caption: `seed ${seed} · ${creatures} creatures · ${items} items`,
    html: levelToHtml(level),
  });
  if (!legend) legend = mapLegendHtml(level);
}

const title = `${pipelineId} — ${count} seed${count === 1 ? '' : 's'}`;
writeFileSync(outPath, renderMapsDocument({ title, legend, panels }));
console.log(`Wrote ${outPath} — ${pipelineId}, seeds 1–${count}`);
