import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createGoblin, createOrc, createScuttler } from '../../entities/creatures.js';
import { createPlayer } from '../../entities/player.js';
import { getScore, getAccumulator } from '../../../attributes/attribute-access.js';
import { distributeLevelUpPoints } from '../../systems/level-up.js';
import { xpForLevel } from '../../../../data/attribute-set.js';
import { run } from './stage-scale-creatures.js';

// The stage ignores `level`/`blackboard`/`rng`; pass throwaways.
const scale = (registry, levels) => run(null, { levels }, null, null, registry);

describe('stage-scale-creatures', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('boots a matched creature to the configured level: stats, xp, and derived level', () => {
    const goblin = createGoblin(registry, 0, 0);
    const spec = goblin.components.get('levelUp');
    const baseStr = getScore(goblin, 'str');
    const baseCon = getScore(goblin, 'con');
    // Expected growth comes from the creature's own spec (not hard-coded base stats), so this
    // survives routine monster balance tuning.
    const gained = distributeLevelUpPoints(spec.attributePercentages, (3 - 1) * spec.points);

    scale(registry, { goblin: 3 });

    expect(getScore(goblin, 'level')).toBe(3);
    expect(getAccumulator(goblin, 'xp')).toBe(xpForLevel(3));
    expect(getScore(goblin, 'str')).toBe(baseStr + (gained.str ?? 0));
    expect(getScore(goblin, 'con')).toBe(baseCon + (gained.con ?? 0));
    expect(spec.lastLevel).toBe(3);
  });

  it('leaves a creature present but not named in the config untouched', () => {
    const orc = createOrc(registry, 0, 0);
    const baseStr = getScore(orc, 'str');
    scale(registry, { goblin: 3 });
    expect(getScore(orc, 'level')).toBe(1);
    expect(getScore(orc, 'str')).toBe(baseStr);
    expect(orc.components.get('levelUp').lastLevel).toBe(1);
  });

  it('is a no-op when a configured type is absent from the map', () => {
    const orc = createOrc(registry, 0, 0);
    expect(() => scale(registry, { goblin: 2, scuttler: 2 })).not.toThrow();
    expect(getScore(orc, 'level')).toBe(1);
  });

  it('scales several types in one run', () => {
    const goblin = createGoblin(registry, 0, 0);
    const scuttler = createScuttler(registry, 1, 0);
    scale(registry, { goblin: 2, scuttler: 2 });
    expect(getScore(goblin, 'level')).toBe(2);
    expect(getScore(scuttler, 'level')).toBe(2);
  });

  it('never scales a dynamic grower (the player), even if named', async () => {
    const player = await createPlayer(registry, 0, 0);
    scale(registry, { player: 5 });
    expect(getScore(player, 'level')).toBe(1);
    expect(player.components.get('levelUp').lastLevel).toBe(1);
  });

  it('clamps the target to the spec maxLevel', () => {
    const goblin = createGoblin(registry, 0, 0);
    goblin.components.get('levelUp').maxLevel = 2;
    scale(registry, { goblin: 10 });
    expect(getScore(goblin, 'level')).toBe(2);
  });

  it('is idempotent when the stage re-runs', () => {
    const goblin = createGoblin(registry, 0, 0);
    scale(registry, { goblin: 3 });
    const str = getScore(goblin, 'str');
    scale(registry, { goblin: 3 });
    expect(getScore(goblin, 'str')).toBe(str);
    expect(getScore(goblin, 'level')).toBe(3);
  });
});
