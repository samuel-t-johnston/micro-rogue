import { describe, it, expect, beforeEach } from 'vitest';
import { tickHunger } from './hunger.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../map/level.js';
import { components } from '../entities/components.js';
import { gameLog } from '../../engine/log/game-log.js';
import { getPool } from '../../attributes/attribute-access.js';
import { rng } from '../../engine/core/rng.js';

// A player with hunger (con 10 → max 100, so thresholds fall at 40 and 20) and a deep HP pool so
// starvation bites don't kill during the message tests.
function makePlayer(hunger) {
  const registry = createEntityRegistry();
  const player = registry.createEntity();
  registry.addComponent(
    player,
    'attributes',
    components.attributes({ con: 10, hunger, hp: 100, hpBase: 200 }),
  );
  const level = createLevel();
  return { registry, player, level };
}

const lastDisplay = () => gameLog.getDisplayEntries(1)[0]?.display ?? null;

describe('tickHunger', () => {
  beforeEach(() => {
    gameLog.reset();
    rng.init(1); // deterministic starvation rolls
  });

  it('drains hunger by 1 each turn, clamped at 0', () => {
    const { registry, player, level } = makePlayer(100);
    const next = tickHunger(player, level, registry, 100);
    expect(next).toBe(99);
    expect(getPool(player, 'hunger').current).toBe(99);
  });

  it('does not drain below 0', () => {
    const { registry, player, level } = makePlayer(0);
    expect(tickHunger(player, level, registry, 0)).toBe(0);
  });

  it('warns "hungry" when dropping below 40% of max', () => {
    const { registry, player, level } = makePlayer(40);
    tickHunger(player, level, registry, 40);
    expect(lastDisplay()).toBe('You are hungry.');
  });

  it('warns "starving" when dropping below 20% of max', () => {
    const { registry, player, level } = makePlayer(20);
    tickHunger(player, level, registry, 20);
    expect(lastDisplay()).toBe('You are starving.');
  });

  it('warns "dying of starvation" when dropping to 0', () => {
    const { registry, player, level } = makePlayer(1);
    tickHunger(player, level, registry, 1);
    expect(lastDisplay()).toBe('You are dying of starvation.');
  });

  it('stays quiet while sitting below a threshold (only the crossing speaks)', () => {
    const { registry, player, level } = makePlayer(30);
    tickHunger(player, level, registry, 30); // 30 → 29, both below 40%: no new crossing
    expect(lastDisplay()).toBeNull();
  });

  it('says "less hungry" after eating to below 40%', () => {
    const { registry, player, level } = makePlayer(15); // as if satiate raised it from 5 to 15
    tickHunger(player, level, registry, 5);
    expect(lastDisplay()).toBe('You feel less hungry.');
  });

  it('says "full" after eating past 40%', () => {
    const { registry, player, level } = makePlayer(65);
    tickHunger(player, level, registry, 35);
    expect(lastDisplay()).toBe('You feel full.');
  });

  it('says "stuffed!" after eating to max', () => {
    const { registry, player, level } = makePlayer(100);
    tickHunger(player, level, registry, 95);
    expect(lastDisplay()).toBe('You feel stuffed!');
  });

  it('can bite for damage on an empty stomach, at most 1 per turn', () => {
    const { registry, player, level } = makePlayer(0);
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
      const { registry, player, level } = makePlayer(0);
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
    const { registry, player, level } = makePlayer(50);
    const before = getPool(player, 'hp').current;
    tickHunger(player, level, registry, 50);
    expect(getPool(player, 'hp').current).toBe(before);
  });
});
