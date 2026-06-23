import { describe, it, expect } from 'vitest';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { run as runLabel } from './stage-label.js';
import { run as runCarveRooms } from './stage-carve-rooms.js';
import { run as runSpawn } from './stage-spawn.js';
import { createLevel } from '../../level.js';
import { createEntityRegistry } from '../../../engine/entity-component-system.js';
import { createRng } from '../../../engine/rng.js';

function generate(seed = 1) {
  const level = createLevel();
  const reg = createEntityRegistry();
  const bb = level.blackboard;
  runRoomGridGeometry(level, {}, bb, createRng(seed));
  runLabel(level, {}, bb, createRng(seed));
  runCarveRooms(level, {}, bb, createRng(seed));
  runSpawn(level, {}, bb, createRng(seed), reg);
  return { level, bb, reg };
}

const cellsOf = (zone) => new Set(zone.cells.map(([c, r]) => `${c},${r}`));

describe('spawn stage', () => {
  it('places exactly one entry point, on a floor tile inside the stairs-up zone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { level, bb, reg } = generate(seed);
      const entries = reg.getEntitiesWith('entryPoint');
      expect(entries).toHaveLength(1);

      const pos = entries[0].components.get('position');
      expect(level.tiles[pos.y][pos.x]).toBe('floor');

      const stairsUp = bb['level:zones'].find((z) => z.labels.includes('stairs-up'));
      const cs = bb['level:grid'].cellSize;
      const cell = `${Math.floor(pos.x / cs)},${Math.floor(pos.y / cs)}`;
      expect(cellsOf(stairsUp).has(cell)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generate(5).reg.getEntitiesWith('entryPoint')[0].components.get('position');
    const b = generate(5).reg.getEntitiesWith('entryPoint')[0].components.get('position');
    expect(a).toEqual(b);
  });
});
