import { describe, it, expect, beforeEach } from 'vitest';
import { tickHunger } from './hunger.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../map/level.js';
import { components } from '../entities/components.js';
import { gameLog } from '../../engine/log/game-log.js';
import { getPool, setPoolCurrent } from '../../attributes/attribute-access.js';
import { rng } from '../../engine/core/rng.js';

// Fraction-of-max thresholds hunger.js announces at — the design contract, not a tuning knob. Tests
// express hunger as fractions of the *derived* max so they stay correct as the hunger-from-CON
// coefficient is tuned.
const HUNGRY = 0.4;
const STARVING = 0.2;

// A player whose hunger max derives from con, plus a deep HP pool so starvation bites don't kill during
// the message tests. Returns the derived max for the fraction math.
function makePlayer() {
  const registry = createEntityRegistry();
  const player = registry.createEntity();
  registry.addComponent(
    player,
    'attributes',
    components.attributes({ con: 10, hp: 100, hpBase: 200 }),
  );
  const level = createLevel();
  return { registry, player, level, max: getPool(player, 'hunger').max };
}

// Puts hunger at `value`, returning it to pass as the previous turn's baseline (lastHunger).
function seed(player, value) {
  setPoolCurrent(player, 'hunger', value);
  return value;
}

const lastDisplay = () => gameLog.getDisplayEntries(1)[0]?.display ?? null;

describe('tickHunger', () => {
  beforeEach(() => {
    gameLog.reset();
    rng.init(1); // deterministic starvation rolls
  });

  it('drains hunger by 1 each turn, clamped at 0', () => {
    const { registry, player, level, max } = makePlayer();
    const last = seed(player, max);
    expect(tickHunger(player, level, registry, last)).toBe(max - 1);
    expect(getPool(player, 'hunger').current).toBe(max - 1);
  });

  it('does not drain below 0', () => {
    const { registry, player, level } = makePlayer();
    seed(player, 0);
    expect(tickHunger(player, level, registry, 0)).toBe(0);
  });

  it('warns "hungry" when dropping below 40% of max', () => {
    const { registry, player, level, max } = makePlayer();
    const last = seed(player, HUNGRY * max);
    tickHunger(player, level, registry, last);
    expect(lastDisplay()).toBe('You are hungry.');
  });

  it('warns "starving" when dropping below 20% of max', () => {
    const { registry, player, level, max } = makePlayer();
    const last = seed(player, STARVING * max);
    tickHunger(player, level, registry, last);
    expect(lastDisplay()).toBe('You are starving.');
  });

  it('warns "dying of starvation" when dropping to 0', () => {
    const { registry, player, level } = makePlayer();
    const last = seed(player, 1);
    tickHunger(player, level, registry, last);
    expect(lastDisplay()).toBe('You are dying of starvation.');
  });

  it('stays quiet while sitting below a threshold (only the crossing speaks)', () => {
    const { registry, player, level, max } = makePlayer();
    const last = seed(player, 0.3 * max); // already below 40%, above 20%: no new crossing this tick
    tickHunger(player, level, registry, last);
    expect(lastDisplay()).toBeNull();
  });

  it('says "less hungry" after eating to below 40%', () => {
    const { registry, player, level, max } = makePlayer();
    seed(player, 0.3 * max); // peak this turn, as if satiate raised it here
    tickHunger(player, level, registry, 0.1 * max); // rose from a lower baseline → ate
    expect(lastDisplay()).toBe('You feel less hungry.');
  });

  it('says "full" after eating past 40%', () => {
    const { registry, player, level, max } = makePlayer();
    seed(player, 0.65 * max);
    tickHunger(player, level, registry, 0.35 * max);
    expect(lastDisplay()).toBe('You feel full.');
  });

  it('says "stuffed!" after eating to max', () => {
    const { registry, player, level, max } = makePlayer();
    seed(player, max);
    tickHunger(player, level, registry, 0.95 * max);
    expect(lastDisplay()).toBe('You feel stuffed!');
  });

  it('can bite for damage on an empty stomach, at most 1 per turn', () => {
    const { registry, player, level } = makePlayer();
    seed(player, 0);
    const before = getPool(player, 'hp').current;
    let bites = 0;
    for (let i = 0; i < 30; i++) {
      const hp = getPool(player, 'hp').current;
      tickHunger(player, level, registry, 0);
      const lost = hp - getPool(player, 'hp').current;
      expect(lost === 0 || lost === 1).toBe(true);
      bites += lost;
    }
    expect(bites).toBeGreaterThan(0); // roughly half of 30 turns
    expect(getPool(player, 'hp').current).toBe(before - bites);
  });

  it('is deterministic: the same seed yields the same starvation damage', () => {
    const run = () => {
      rng.init(42);
      const { registry, player, level } = makePlayer();
      seed(player, 0);
      let bites = 0;
      for (let i = 0; i < 20; i++) {
        const hp = getPool(player, 'hp').current;
        tickHunger(player, level, registry, 0);
        bites += hp - getPool(player, 'hp').current;
      }
      return bites;
    };
    expect(run()).toBe(run());
  });

  it('does not bite while the stomach is not empty', () => {
    const { registry, player, level, max } = makePlayer();
    const last = seed(player, 0.5 * max);
    const before = getPool(player, 'hp').current;
    tickHunger(player, level, registry, last);
    expect(getPool(player, 'hp').current).toBe(before);
  });
});
