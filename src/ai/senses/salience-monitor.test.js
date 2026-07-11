import { describe, it, expect } from 'vitest';
import { snapshot, diff } from './salience-monitor.js';

// A perceived hostile actor observation, in the shape buildPlanningContext produces.
const hostile = (entityId) => ({ entityId, tags: { isActor: true }, factions: ['monster'] });
const ally = (entityId) => ({ entityId, tags: { isActor: true }, factions: ['player'] });
const item = (entityId) => ({ entityId, tags: { isActor: false }, factions: [] });

// A minimal planning context: player faction + hp, plus the merged perception entities.
const ctx = (entities, hp) => ({
  selfState: { factions: ['player'], hp },
  perception: { entities },
});

describe('salience monitor snapshot', () => {
  it('captures the ids of perceived hostiles and current hp', () => {
    const base = snapshot(ctx([hostile('g1'), ally('p1'), item('rock')], 20));
    expect(base.enemyIds).toEqual(['g1']);
    expect(base.hp).toBe(20);
  });
});

describe('salience monitor diff', () => {
  it('alerts on a hostile that was not in the baseline', () => {
    const base = snapshot(ctx([], 20));
    const { alerted, reasons } = diff(base, ctx([hostile('g1')], 20));
    expect(alerted).toBe(true);
    expect(reasons).toContainEqual({ type: 'newHostile', id: 'g1' });
  });

  it('does not alert on a hostile already known in the baseline', () => {
    const base = snapshot(ctx([hostile('g1')], 20));
    expect(diff(base, ctx([hostile('g1')], 20)).alerted).toBe(false);
  });

  it('does not alert when a known hostile leaves perception', () => {
    const base = snapshot(ctx([hostile('g1')], 20));
    expect(diff(base, ctx([], 20)).alerted).toBe(false);
  });

  it('ignores non-hostile actors and non-actors', () => {
    const base = snapshot(ctx([], 20));
    expect(diff(base, ctx([ally('p1'), item('rock')], 20)).alerted).toBe(false);
  });

  it('alerts on any drop in hp', () => {
    const base = snapshot(ctx([], 20));
    const { alerted, reasons } = diff(base, ctx([], 19));
    expect(alerted).toBe(true);
    expect(reasons).toContainEqual({ type: 'hpDrop', current: 19, previous: 20 });
  });

  it('does not alert when hp is unchanged or higher', () => {
    const base = snapshot(ctx([], 20));
    expect(diff(base, ctx([], 20)).alerted).toBe(false);
    expect(diff(base, ctx([], 25)).alerted).toBe(false);
  });

  it('reports both a new hostile and an hp drop together', () => {
    const base = snapshot(ctx([], 20));
    const { reasons } = diff(base, ctx([hostile('g1')], 18));
    expect(reasons).toContainEqual({ type: 'newHostile', id: 'g1' });
    expect(reasons).toContainEqual({ type: 'hpDrop', current: 18, previous: 20 });
  });

  it('is inert against a missing baseline (mid-move save without the key)', () => {
    expect(diff(undefined, ctx([hostile('g1')], 5)).alerted).toBe(false);
  });
});
