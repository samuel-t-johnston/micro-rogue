import { describe, it, expect, vi } from 'vitest';
import { createTurnManager } from './turn-manager.js';

function makeEntity(id, speed = 1, isPlayer = false) {
  const components = new Map([
    ['turnTaker', { speed, accumulator: 0 }],
  ]);
  if (isPlayer) components.set('playerControlled', {});
  return { id, components };
}

// Waits until the assertion function passes, then stops the manager.
// The assertion function must use expect() so vi.waitFor can detect failure.
async function runUntil(tm, assertFn, timeout = 2000) {
  await vi.waitFor(assertFn, { timeout });
  tm.stop();
}

describe('createTurnManager', () => {
  describe('queue management', () => {
    it('calls invokeAction for each active entity', async () => {
      const entity = makeEntity(1);
      let acts = 0;
      const tm = createTurnManager({
        getActiveEntities: () => [entity],
        invokeAction: async () => { acts++; return false; },
      });
      tm.start();
      await runUntil(tm, () => expect(acts).toBeGreaterThanOrEqual(3));
      expect(acts).toBeGreaterThanOrEqual(3);
    });

    it('stops calling invokeAction after an entity leaves the active set', async () => {
      const a = makeEntity(1);
      const b = makeEntity(2);
      let aActs = 0;
      let bActs = 0;
      let bActive = true;

      const tm = createTurnManager({
        getActiveEntities: () => bActive ? [a, b] : [a],
        invokeAction: async (e) => {
          if (e.id === 1) aActs++;
          else bActs++;
          return false;
        },
      });
      tm.start();

      await vi.waitFor(() => expect(bActs).toBeGreaterThanOrEqual(2), { timeout: 2000 });
      const bActsAtRemoval = bActs;
      bActive = false;

      await runUntil(tm, () => expect(aActs).toBeGreaterThanOrEqual(bActsAtRemoval + 3));
      expect(bActs).toBe(bActsAtRemoval);
    });
  });

  describe('energy accumulator', () => {
    it('slow entity (speed 0.5) acts less often than a normal entity', async () => {
      const slow = makeEntity(1, 0.5);
      const normal = makeEntity(2, 1.0);
      let slowActs = 0;
      let normalActs = 0;

      const tm = createTurnManager({
        getActiveEntities: () => [slow, normal],
        invokeAction: async (e) => {
          if (e.id === 1) slowActs++;
          else normalActs++;
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () => expect(normalActs).toBeGreaterThanOrEqual(6));
      expect(slowActs).toBeLessThan(normalActs);
    });

    it('fast entity (speed 2) acts roughly twice as often as a normal entity', async () => {
      const fast = makeEntity(1, 2);
      const normal = makeEntity(2, 1.0);
      let fastActs = 0;
      let normalActs = 0;

      const tm = createTurnManager({
        getActiveEntities: () => [fast, normal],
        invokeAction: async (e) => {
          if (e.id === 1) fastActs++;
          else normalActs++;
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () => expect(normalActs).toBeGreaterThanOrEqual(4));
      expect(fastActs).toBeGreaterThanOrEqual(normalActs * 1.5);
    });
  });

  describe('free actions', () => {
    it('does not increment playerTurnCount on free actions', async () => {
      const player = makeEntity(1, 1, true);
      let call = 0;

      const tm = createTurnManager({
        getActiveEntities: () => [player],
        invokeAction: async () => call++ < 3, // first 3 calls are free
      });
      tm.start();
      await runUntil(tm, () => expect(tm.playerTurnCount).toBeGreaterThanOrEqual(1));
      expect(tm.playerTurnCount).toBeLessThan(call);
    });
  });

  describe('playerTurnCount', () => {
    it('increments exactly once per real player action', async () => {
      const player = makeEntity(1, 1, true);
      let acts = 0;

      const tm = createTurnManager({
        getActiveEntities: () => [player],
        invokeAction: async () => { acts++; return false; },
      });
      tm.start();
      await runUntil(tm, () => expect(acts).toBeGreaterThanOrEqual(5));
      expect(tm.playerTurnCount).toBe(acts);
    });

    it('does not increment for non-player entities', async () => {
      const npc = makeEntity(1, 1, false);
      let acts = 0;

      const tm = createTurnManager({
        getActiveEntities: () => [npc],
        invokeAction: async () => { acts++; return false; },
      });
      tm.start();
      await runUntil(tm, () => expect(acts).toBeGreaterThanOrEqual(5));
      expect(tm.playerTurnCount).toBe(0);
    });
  });
});
