import { describe, it, expect } from 'vitest';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { run as runLabel } from './stage-label.js';
import { run as runCarveRooms } from './stage-carve-rooms.js';
import { run as runPopulate, weightedPick } from './stage-populate.js';
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
  runPopulate(level, {}, bb, createRng(seed), reg);
  return { level, bb, reg };
}

const zoneOf = (pos, bb) => {
  const cs = bb['level:grid'].cellSize;
  const cell = `${Math.floor(pos.x / cs)},${Math.floor(pos.y / cs)}`;
  return bb['level:zones'].find(z => z.cells.some(([c, r]) => `${c},${r}` === cell));
};

describe('weightedPick', () => {
  it('favours higher-weighted rooms', () => {
    const rooms = [{ id: 0, labels: ['room'] }, { id: 1, labels: ['room', 'treasure'] }];
    const rng = createRng(1);
    let treasure = 0;
    for (let i = 0; i < 400; i++) if (weightedPick(rooms, { treasure: 9 }, rng).id === 1) treasure++;
    expect(treasure).toBeGreaterThan(300); // ~9:1 toward the treasure room
  });

  it('falls back to uniform when all weights are zero', () => {
    const rooms = [{ id: 0, labels: ['room'] }, { id: 1, labels: ['room'] }];
    expect(() => weightedPick(rooms, {}, createRng(1))).not.toThrow();
  });
});

describe('populate stage', () => {
  it('puts a chest with 1-3 items in each treasure room', () => {
    const { bb, reg } = generate(2);
    const treasureZones = bb['level:zones'].filter(z => z.labels.includes('treasure'));
    const chests = reg.getEntitiesWith('container');
    expect(chests).toHaveLength(treasureZones.length);
    for (const chest of chests) {
      const n = chest.components.get('inventory').items.length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('spawns the configured creatures, none on the stairs-up room, none stacked', () => {
    const { level, bb, reg } = generate(2);
    const creatures = reg.getEntitiesWith('ai');
    expect(creatures).toHaveLength(4); // 2 orcs + 2 goblins

    const seen = new Set();
    for (const c of creatures) {
      const pos = c.components.get('position');
      expect(level.tiles[pos.y][pos.x]).toBe('floor');
      const k = `${pos.x},${pos.y}`;
      expect(seen.has(k)).toBe(false); // no two creatures share a tile
      seen.add(k);
      expect(zoneOf(pos, bb).labels.includes('stairs-up')).toBe(false);
    }
  });

  it('places goblins in separate rooms', () => {
    const { bb, reg } = generate(2);
    const goblinRooms = reg.getEntitiesWith('ai')
      .filter(c => c.components.get('name') === 'Goblin')
      .map(c => zoneOf(c.components.get('position'), bb).id);
    expect(new Set(goblinRooms).size).toBe(goblinRooms.length);
  });

  it('orcs favour treasure/item rooms more than goblins do (affinity vs aversion)', () => {
    let orcLabeled = 0;
    let goblinLabeled = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { bb, reg } = generate(seed);
      for (const c of reg.getEntitiesWith('ai')) {
        const labels = zoneOf(c.components.get('position'), bb).labels;
        const inLabeled = labels.includes('treasure') || labels.includes('item');
        if (c.components.get('name') === 'Orc' && inLabeled) orcLabeled++;
        if (c.components.get('name') === 'Goblin' && inLabeled) goblinLabeled++;
      }
    }
    expect(orcLabeled).toBeGreaterThan(goblinLabeled);
  });

  it('is deterministic for a given seed', () => {
    const fingerprint = (g) => g.reg.getEntitiesWith('renderable')
      .map(e => { const p = e.components.get('position'); return `${e.components.get('name')}@${p ? `${p.x},${p.y}` : '-'}`; })
      .sort();
    expect(fingerprint(generate(8))).toEqual(fingerprint(generate(8)));
  });
});
