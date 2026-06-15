import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createRng } from '../../engine/rng.js';

describe('runPipeline', () => {
  it('rejects for an unknown stage type', async () => {
    const config = { stages: [{ type: 'nonexistent' }] };
    await expect(runPipeline(config, null, null)).rejects.toThrow('Unknown pipeline stage type: "nonexistent"');
  });

  it('returns a level with empty state for a pipeline with no stages', async () => {
    const level = await runPipeline({ stages: [] }, null, null);
    expect(level.width).toBe(0);
    expect(level.height).toBe(0);
    expect(level.tiles).toEqual([]);
  });

  it('fires onStageComplete after each stage, in order, with the level', async () => {
    const config = { stages: [{ type: 'roomGridGeometry' }, { type: 'label' }] };
    const calls = [];
    const level = await runPipeline(config, createRng(1), createEntityRegistry(), {
      onStageComplete: (stage, lvl) => calls.push([stage, lvl]),
    });
    expect(calls.map(c => c[0])).toEqual(['roomGridGeometry', 'label']);
    expect(calls.every(c => c[1] === level)).toBe(true);
  });
});
