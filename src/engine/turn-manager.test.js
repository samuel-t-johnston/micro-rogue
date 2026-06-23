import { describe, it, expect, vi } from 'vitest';
import { createTurnManager } from './turn-manager.js';

function makeEntity(id, speed = 1, isPlayer = false) {
  const components = new Map([['turnTaker', { speed, accumulator: 0 }]]);
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
        invokeAction: async () => {
          acts++;
          return false;
        },
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
        getActiveEntities: () => (bActive ? [a, b] : [a]),
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

  describe('decay entities (no turnTaker)', () => {
    // A decay-only entity rides the queue purely to age; invokeAction does the decrement/destroy.
    const decayEntity = (id) => ({ id, components: new Map([['decay', { lifespan: 2 }]]) });

    it('calls invokeAction once per pass for a queue member without a turnTaker', async () => {
      const sound = decayEntity(1);
      let acts = 0;
      const tm = createTurnManager({
        getActiveEntities: () => [sound],
        invokeAction: async () => {
          acts++;
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () => expect(acts).toBeGreaterThanOrEqual(3));
      expect(acts).toBeGreaterThanOrEqual(3);
    });

    it('does not count a decay entity as a player turn', async () => {
      const sound = decayEntity(1);
      const tm = createTurnManager({
        getActiveEntities: () => [sound],
        invokeAction: async () => false,
      });
      tm.start();
      await runUntil(tm, () => expect(tm.currentEntity).toBe(sound));
      expect(tm.playerTurnCount).toBe(0);
    });

    it('keeps processing turnTakers alongside a decay entity', async () => {
      const sound = decayEntity(1);
      const creature = makeEntity(2);
      let creatureActs = 0;
      const tm = createTurnManager({
        getActiveEntities: () => [sound, creature],
        invokeAction: async (e) => {
          if (e.id === 2) creatureActs++;
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () => expect(creatureActs).toBeGreaterThanOrEqual(3));
      expect(creatureActs).toBeGreaterThanOrEqual(3);
    });
  });

  describe('actCount (per-entity clock)', () => {
    it('increments turnTaker.actCount each turn the entity acts', async () => {
      const entity = makeEntity(1); // helper omits actCount, so this also exercises the ?? 0 guard
      const tm = createTurnManager({
        getActiveEntities: () => [entity],
        invokeAction: async () => false,
      });
      tm.start();
      await runUntil(tm, () =>
        expect(entity.components.get('turnTaker').actCount).toBeGreaterThanOrEqual(3),
      );
      expect(entity.components.get('turnTaker').actCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('onTurnStart', () => {
    it('fires before the entity acts each turn', async () => {
      const entity = makeEntity(1);
      const events = [];
      const tm = createTurnManager({
        getActiveEntities: () => [entity],
        onTurnStart: (e) => events.push(`start:${e.id}`),
        invokeAction: async (e) => {
          events.push(`act:${e.id}`);
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () =>
        expect(events.filter((e) => e === 'act:1').length).toBeGreaterThanOrEqual(2),
      );
      // Every act is immediately preceded by a start for the same entity.
      const firstActIdx = events.indexOf('act:1');
      expect(events[firstActIdx - 1]).toBe('start:1');
    });
  });

  describe('onTurnEnd', () => {
    it('fires after the entity acts, carrying the action free flag', async () => {
      const entity = makeEntity(1);
      const events = [];
      const tm = createTurnManager({
        getActiveEntities: () => [entity],
        onTurnEnd: (e, { free }) => events.push(`end:${e.id}:${free}`),
        invokeAction: async (e) => {
          events.push(`act:${e.id}`);
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () =>
        expect(events.filter((e) => e === 'act:1').length).toBeGreaterThanOrEqual(2),
      );
      // Every act is immediately followed by an end for the same entity, with the free flag.
      const firstActIdx = events.indexOf('act:1');
      expect(events[firstActIdx + 1]).toBe('end:1:false');
    });

    it('reports free:true for a free action', async () => {
      const entity = makeEntity(1, 1, true);
      let call = 0;
      const frees = [];
      const tm = createTurnManager({
        getActiveEntities: () => [entity],
        onTurnEnd: (_e, { free }) => frees.push(free),
        invokeAction: async () => call++ < 2, // first 2 free, then non-free so the loop drains and yields
      });
      tm.start();
      await runUntil(tm, () => expect(frees.length).toBeGreaterThanOrEqual(4));
      expect(frees.slice(0, 3)).toEqual([true, true, false]);
    });
  });

  describe('initialTurnCount', () => {
    it('seeds playerTurnCount so a loaded game resumes its turn count', async () => {
      const player = makeEntity(1, 1, true);
      const tm = createTurnManager({
        getActiveEntities: () => [player],
        invokeAction: async () => false,
        initialTurnCount: 41,
      });
      expect(tm.playerTurnCount).toBe(41);
      tm.start();
      await runUntil(tm, () => expect(tm.playerTurnCount).toBeGreaterThanOrEqual(42));
    });
  });

  describe('playerTurnCount', () => {
    it('increments exactly once per real player action', async () => {
      const player = makeEntity(1, 1, true);
      let acts = 0;

      const tm = createTurnManager({
        getActiveEntities: () => [player],
        invokeAction: async () => {
          acts++;
          return false;
        },
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
        invokeAction: async () => {
          acts++;
          return false;
        },
      });
      tm.start();
      await runUntil(tm, () => expect(acts).toBeGreaterThanOrEqual(5));
      expect(tm.playerTurnCount).toBe(0);
    });
  });
});
