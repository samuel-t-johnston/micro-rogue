import { describe, it, expect, beforeEach } from 'vitest';
import { awardKillXp } from './kill-reward.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';
import { getAccumulator } from '../attributes/attribute-access.js';
import { gameLog } from '../engine/log/game-log.js';

describe('awardKillXp', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
    gameLog.reset();
  });

  // A creature worth XP: xp seeds its level (0→L1, 10→L2, 30→L3 via the default curve).
  function makeCreature(xp) {
    const e = registry.createEntity();
    registry.addComponent(e, 'creature', components.creature());
    registry.addComponent(e, 'attributes', components.attributes({ xp }));
    return e;
  }

  function makeKiller({ player = false } = {}) {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes({ xp: 0 }));
    if (player) registry.addComponent(e, 'playerControlled', components.playerControlled());
    return e;
  }

  const logged = (re) => gameLog.getAll().some((e) => e.display && re.test(e.display));

  it('grants xp scaled by the victim level (5 per level)', () => {
    const killer = makeKiller();
    awardKillXp(makeCreature(10), killer); // victim level 2
    expect(getAccumulator(killer, 'xp')).toBe(10);
  });

  it('a level-1 victim is worth one level of xp', () => {
    const killer = makeKiller();
    awardKillXp(makeCreature(0), killer);
    expect(getAccumulator(killer, 'xp')).toBe(5);
  });

  it('does nothing without a killer', () => {
    expect(() => awardKillXp(makeCreature(0), null)).not.toThrow();
  });

  it('does not grant xp for a self-kill', () => {
    const e = makeKiller();
    registry.addComponent(e, 'creature', components.creature()); // would otherwise qualify as a victim
    awardKillXp(e, e);
    expect(getAccumulator(e, 'xp')).toBe(0);
  });

  it('grants nothing for a non-creature victim', () => {
    const barrel = registry.createEntity();
    registry.addComponent(barrel, 'attributes', components.attributes({ xp: 30 }));
    const killer = makeKiller();
    awardKillXp(barrel, killer);
    expect(getAccumulator(killer, 'xp')).toBe(0);
  });

  it('skips a killer with no attributes component instead of throwing', () => {
    const killer = registry.createEntity();
    expect(() => awardKillXp(makeCreature(10), killer)).not.toThrow();
  });

  it('logs the gain for a player killer', () => {
    awardKillXp(makeCreature(0), makeKiller({ player: true }));
    expect(logged(/gain 5 experience/i)).toBe(true);
  });

  it('a creature killer gains xp silently (no log spam)', () => {
    const killer = makeKiller();
    awardKillXp(makeCreature(0), killer);
    expect(getAccumulator(killer, 'xp')).toBe(5);
    expect(logged(/experience/i)).toBe(false);
  });
});
