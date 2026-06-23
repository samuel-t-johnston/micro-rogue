#!/usr/bin/env node
// Dev-only generation visualizer. Runs a pipeline (or a single stage) N times and writes a markdown
// report: the config, a timestamp, the seeds used, and a per-run "filmstrip" — a snapshot of the
// topology + map after each stage. Headless; pulls in only the level-building code, no game runtime.
//
// Usage:  node scripts/visualize-generation.mjs [runs] [baseSeed] [outPath]
//   runs      number of layouts to generate (default 1)
//   baseSeed  first generation-stream seed; run i uses baseSeed + i (default 1)
//   outPath   markdown output (default generation-report.md, gitignored)
//
// Edit PIPELINE below to visualize a different set of stages or stage params.
import { writeFileSync } from 'node:fs';
import { runPipeline } from '../src/world/generation/pipeline.js';
import { createEntityRegistry } from '../src/engine/entity-component-system.js';
import { createRng } from '../src/engine/rng.js';
import { levelToAscii, zonesToText, zonesToMermaid } from '../src/world/generation/visualize.js';

const PIPELINE = {
  stages: [
    { type: 'roomGridGeometry' },
    { type: 'label' },
    { type: 'link' },
    { type: 'carveRooms' },
    { type: 'carveHalls' },
    { type: 'stairs' },
    { type: 'spawn' },
    { type: 'populate' },
  ],
};

const runs = Number(process.argv[2] ?? 1);
const baseSeed = Number(process.argv[3] ?? 1);
const outPath = process.argv[4] ?? 'generation-report.md';
const seeds = Array.from({ length: runs }, (_, i) => baseSeed + i);

async function snapshotRun(seed) {
  const frames = [];
  await runPipeline(PIPELINE, createRng(seed), createEntityRegistry(), {
    onStageComplete: (stage, level) =>
      frames.push({
        stage,
        topology: zonesToText(level.blackboard),
        mermaid: zonesToMermaid(level.blackboard),
        ascii: levelToAscii(level),
      }),
  });
  return frames;
}

function frameMd(f) {
  return [
    `### after \`${f.stage}\``,
    '',
    '```',
    f.topology,
    '```',
    '',
    '```mermaid',
    f.mermaid,
    '```',
    '',
    '_map:_',
    '```',
    f.ascii,
    '```',
  ].join('\n');
}

const parts = [
  '# Generation report',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Pipeline: \`${JSON.stringify(PIPELINE.stages)}\``,
  `- Runs: ${runs}`,
  `- Seeds: ${seeds.join(', ')}`,
  '',
];

for (const seed of seeds) {
  parts.push(`## Run — seed ${seed}`, '');
  for (const f of await snapshotRun(seed)) parts.push(frameMd(f), '');
}

writeFileSync(outPath, parts.join('\n'));
console.log(`Wrote ${outPath} — ${runs} run(s), seeds ${seeds[0]}–${seeds[seeds.length - 1]}`);
