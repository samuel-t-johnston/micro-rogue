import { describe, it, expect, vi } from 'vitest';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { run as runLabel } from './stage-label.js';
import { run as runCarveRooms } from './stage-carve-rooms.js';
import { run as runStairs } from './stage-stairs.js';
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
  runStairs(level, {}, bb, createRng(seed), reg);
  return { level, bb, reg };
}

const cellOf = (pos, cs) => `${Math.floor(pos.x / cs)},${Math.floor(pos.y / cs)}`;

describe('stairs stage', () => {
  it('places one up and one down stairs on floor in their labelled zones, with inert transitions', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { level, bb, reg } = generate(seed);
      const stairs = reg.getEntitiesWith('transition');
      expect(stairs).toHaveLength(2);

      const up = stairs.find((s) => s.components.get('name') === 'Stairs Up');
      const down = stairs.find((s) => s.components.get('name') === 'Stairs Down');
      expect(up).toBeTruthy();
      expect(down).toBeTruthy();
      expect(up.components.get('transition')).toEqual({ to: null, port: 'up' });
      expect(down.components.get('transition')).toEqual({ to: null, port: 'down' });

      const cs = bb['level:grid'].cellSize;
      for (const [s, label] of [
        [up, 'stairs-up'],
        [down, 'stairs-down'],
      ]) {
        const pos = s.components.get('position');
        expect(level.tiles[pos.y][pos.x]).toBe('floor');
        const zone = bb['level:zones'].find((z) => z.labels.includes(label));
        const cells = new Set(zone.cells.map(([c, r]) => `${c},${r}`));
        expect(cells.has(cellOf(pos, cs))).toBe(true);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const posOf = (g) =>
      g.reg
        .getEntitiesWith('transition')
        .map((s) => s.components.get('position'))
        .map((p) => `${p.x},${p.y}`)
        .sort();
    expect(posOf(generate(5))).toEqual(posOf(generate(5)));
  });

  it('skips (with a warning) a stairs label that has no zone, placing the other', () => {
    // Geometry + carve, but a label set that omits 'stairs-down' entirely.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const level = createLevel();
    const reg = createEntityRegistry();
    const bb = level.blackboard;
    runRoomGridGeometry(level, {}, bb, createRng(1));
    runLabel(level, { labels: ['stairs-up', 'room', 'room'] }, bb, createRng(1));
    runCarveRooms(level, {}, bb, createRng(1));
    runStairs(level, {}, bb, createRng(1), reg);

    const stairs = reg.getEntitiesWith('transition');
    expect(stairs).toHaveLength(1);
    expect(stairs[0].components.get('name')).toBe('Stairs Up');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
