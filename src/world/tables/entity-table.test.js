import { describe, it, expect, beforeEach } from 'vitest';
import { table, row, ref, nothing, rollTable, useTables } from './entity-table.js';
import { createRng } from '../../engine/core/rng.js';

// A tiny spec constructor for tests — the engine treats specs as opaque, so any marker object works.
const spec = (id) => ({ id });

describe('rollTable', () => {
  // The ref catalog is module-level global state; reset it before each test so the ref cases install
  // exactly the tables they intend and nothing leaks between tests.
  beforeEach(() => useTables({}));

  it('emits the specs of the only row', () => {
    const t = table('t', '', { rows: [row(1, () => [spec('a'), spec('b')])] });
    expect(rollTable(t, { rng: createRng(1) })).toEqual([spec('a'), spec('b')]);
  });

  it('is deterministic for a given seed', () => {
    const t = table('t', '', {
      rows: [row(1, () => [spec('a')]), row(1, () => [spec('b')]), row(1, () => [spec('c')])],
    });
    const a = rollTable(t, { rng: createRng(42) });
    const b = rollTable(t, { rng: createRng(42) });
    expect(a).toEqual(b);
  });

  it('picks rows in proportion to their weights', () => {
    const t = table('t', '', { rows: [row(3, () => [spec('a')]), row(1, () => [spec('b')])] });
    const rng = createRng(7);
    let a = 0;
    for (let i = 0; i < 4000; i++) if (rollTable(t, { rng })[0].id === 'a') a++;
    // ~3:1 → ~3000 of 4000. Loose bounds; the assertion is "weight biases the pick", not an exact rate.
    expect(a).toBeGreaterThan(2700);
    expect(a).toBeLessThan(3300);
  });

  it('reads context in a weight function (depth-scaled odds)', () => {
    // At depth 1 the sword row has weight 0 and can never be picked; at depth 9 it dominates.
    const t = table('t', '', {
      rows: [
        row(1, () => [spec('dagger')]),
        row(
          ({ depth }) => depth - 1,
          () => [spec('sword')],
        ),
      ],
    });
    const shallow = new Set();
    const deep = new Set();
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) shallow.add(rollTable(t, { rng, depth: 1 })[0].id);
    for (let i = 0; i < 200; i++) deep.add(rollTable(t, { rng, depth: 9 })[0].id);
    expect([...shallow]).toEqual(['dagger']);
    expect(deep.has('sword')).toBe(true);
  });

  it('rolls a fixed count of times, concatenating results', () => {
    const t = table('t', '', { rolls: 3, rows: [row(1, () => [spec('a')])] });
    expect(rollTable(t, { rng: createRng(1) })).toHaveLength(3);
  });

  it('rolls a random count within an inclusive range', () => {
    const t = table('t', '', { rolls: [2, 4], rows: [row(1, () => [spec('a')])] });
    for (let seed = 0; seed < 50; seed++) {
      const n = rollTable(t, { rng: createRng(seed) }).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it('emits nothing for a nothing row', () => {
    const t = table('t', '', { rows: [row(1, nothing)] });
    expect(rollTable(t, { rng: createRng(1) })).toEqual([]);
  });

  it('emits nothing when every weight is non-positive', () => {
    const t = table('t', '', { rows: [row(0, () => [spec('a')]), row(-5, () => [spec('b')])] });
    expect(rollTable(t, { rng: createRng(1) })).toEqual([]);
  });

  it('resolves a nested table by id from the installed catalog', () => {
    const child = table('child', '', { rows: [row(1, () => [spec('gem')])] });
    const parent = table('parent', '', { rows: [row(1, ref('child'))] });
    useTables({ child });
    expect(rollTable(parent, { rng: createRng(1) })).toEqual([spec('gem')]);
  });

  it('throws on a missing nested table', () => {
    const parent = table('parent', '', { rows: [row(1, ref('missing'))] });
    expect(() => rollTable(parent, { rng: createRng(1) })).toThrow(/unknown table/);
  });

  it('guards against reference cycles', () => {
    const a = table('a', '', { rows: [row(1, ref('b'))] });
    const b = table('b', '', { rows: [row(1, ref('a'))] });
    useTables({ a, b });
    expect(() => rollTable(a, { rng: createRng(1) })).toThrow(/too deep/);
  });
});
