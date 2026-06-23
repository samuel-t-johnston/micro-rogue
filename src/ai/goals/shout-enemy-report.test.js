import { describe, it, expect } from 'vitest';
import { shoutEnemyReport } from './shout-enemy-report.js';

function obs(entityId, x, y, factions, { isActor = true } = {}) {
  return { entityId, position: { x, y }, factions, tags: { isActor } };
}

// Commander at (5,5), faction orcs; hostile factions default to player.
function ctx(entities, memory = {}, { x = 5, y = 5, factions = ['orcs'] } = {}) {
  return { memory, selfState: { position: { x, y }, factions }, perception: { entities } };
}

describe('shoutEnemyReport', () => {
  it('shouts an enemy report with the direction to a newly-seen hostile', () => {
    // Hostile to the north-east of the commander.
    const result = shoutEnemyReport.evaluate(ctx([obs(7, 8, 2, ['player'])]));
    expect(result).toEqual({
      action: {
        type: 'shout',
        volume: expect.any(Number),
        message: { kind: 'enemy-report', direction: 'NE' },
      },
    });
  });

  it('does not shout again for an already-reported enemy still in sight', () => {
    const memory = {};
    const enemy = [obs(7, 8, 5, ['player'])];
    expect(shoutEnemyReport.evaluate(ctx(enemy, memory))).not.toBeNull(); // first sighting → shout
    expect(shoutEnemyReport.evaluate(ctx(enemy, memory))).toBeNull(); // same enemy → fall through
  });

  it('reports again when the enemy leaves sight and returns', () => {
    const memory = {};
    const enemy = [obs(7, 8, 5, ['player'])];
    shoutEnemyReport.evaluate(ctx(enemy, memory)); // reported
    expect(shoutEnemyReport.evaluate(ctx([], memory))).toBeNull(); // out of sight — forgotten
    expect(shoutEnemyReport.evaluate(ctx(enemy, memory))).not.toBeNull(); // re-seen → re-report
  });

  it('ignores same-faction actors and returns null', () => {
    expect(shoutEnemyReport.evaluate(ctx([obs(7, 8, 5, ['orcs'])]))).toBeNull();
  });

  it('returns null when nothing hostile is perceived', () => {
    expect(shoutEnemyReport.evaluate(ctx([]))).toBeNull();
  });
});
