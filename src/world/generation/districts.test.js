import { describe, it, expect } from 'vitest';
import { appendZones } from './zone-tiles.js';
import { run as runLabel } from './stages/stage-label.js';
import { run as runPopulate } from './stages/stage-populate.js';
import { createLevel } from '../map/level.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createRng } from '../../engine/core/rng.js';

// Two districts of chamber zones on a shared floor. Room tiles are irrelevant here except that
// population needs a free floor tile, so give each a small floor patch.
function twoDistricts() {
  const level = createLevel();
  level.width = 20;
  level.height = 6;
  level.tiles = Array.from({ length: 6 }, () => Array(20).fill('floor'));
  const bb = level.blackboard;
  const zone = (id) => ({ id, cells: [[id, 0]], rect: {}, labels: ['room'], kind: 'chamber' });
  const roomAt = (x) => ({
    tiles: [
      [x, 2],
      [x, 3],
    ],
  });
  appendZones(bb, {
    zones: [zone(0), zone(1)],
    rooms: { '0,0': roomAt(2), '1,0': roomAt(5) },
    section: 'west',
  });
  appendZones(bb, {
    zones: [zone(0), zone(1)],
    rooms: { '0,0': roomAt(13), '1,0': roomAt(16) },
    section: 'east',
  });
  return level;
}

describe('district (section-scoped) generation', () => {
  it('appendZones stamps the section on each zone', () => {
    const bb = twoDistricts().blackboard;
    expect(bb['level:zones'].filter((z) => z.section === 'west')).toHaveLength(2);
    expect(bb['level:zones'].filter((z) => z.section === 'east')).toHaveLength(2);
    expect(bb['level:zones'].map((z) => z.id)).toEqual([0, 1, 2, 3]); // still dense, no collision
  });

  it('label restricted to a section only labels that section', () => {
    const level = twoDistricts();
    runLabel(level, { labels: ['stairs-up'], section: 'west' }, level.blackboard, createRng(1));
    const labeled = level.blackboard['level:zones'].filter((z) => z.labels.includes('stairs-up'));
    expect(labeled).toHaveLength(1);
    expect(labeled[0].section).toBe('west');
  });

  it('populate restricted to a section only fills that section', () => {
    const level = twoDistricts();
    const reg = createEntityRegistry();
    runPopulate(
      level,
      { section: 'east', creatures: [{ type: 'goblin', count: 2 }] },
      level.blackboard,
      createRng(1),
      reg,
    );
    const mobs = reg.getEntitiesWith('ai');
    expect(mobs.length).toBeGreaterThan(0);
    // Every creature landed in the east district (x ≥ 13), never the west.
    for (const m of mobs) expect(m.components.get('position').x).toBeGreaterThanOrEqual(13);
  });

  it('with no section set, label/populate span the whole floor (unchanged)', () => {
    const level = twoDistricts();
    runLabel(level, { labels: ['stairs-up', 'stairs-down'] }, level.blackboard, createRng(1));
    const labeled = level.blackboard['level:zones'].filter((z) => z.labels.length > 1);
    // Both roles placed, drawn from either district.
    expect(labeled).toHaveLength(2);
  });
});
