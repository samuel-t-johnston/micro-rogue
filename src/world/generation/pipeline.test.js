import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline.js';

describe('runPipeline', () => {
  it('rejects for an unknown stage type', async () => {
    const config = { stages: [{ type: 'nonexistent' }] };
    await expect(runPipeline(config, null)).rejects.toThrow('Unknown pipeline stage type: "nonexistent"');
  });

  it('returns a level with empty state for a pipeline with no stages', async () => {
    const level = await runPipeline({ stages: [] }, null);
    expect(level.width).toBe(0);
    expect(level.height).toBe(0);
    expect(level.tiles).toEqual([]);
  });
});
