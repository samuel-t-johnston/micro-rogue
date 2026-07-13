import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock every action-type handler so we can assert the dispatch table routes each `type` to the right
// one with the right arguments — 14 of the 15 arrows are otherwise never exercised, so a mis-wire
// (wrong handler, or a dropped level/registry/dialogController arg) would ship silently. Isolated in
// its own file so this heavy handler-mocking doesn't touch the invokeAction tests.
vi.mock('../action-types/action-move.js', () => ({ executeMove: vi.fn(() => 'move') }));
vi.mock('../action-types/action-interact.js', () => ({ executeInteract: vi.fn(() => 'interact') }));
vi.mock('../action-types/action-pickup.js', () => ({ executePickup: vi.fn(() => 'pickup') }));
vi.mock('../action-types/action-self-interact.js', () => ({
  executeSelfInteract: vi.fn(() => 'selfInteract'),
}));
vi.mock('../action-types/action-equip.js', () => ({ executeEquip: vi.fn(() => 'equip') }));
vi.mock('../action-types/action-unequip.js', () => ({ executeUnequip: vi.fn(() => 'unequip') }));
vi.mock('../action-types/action-consume.js', () => ({ executeConsume: vi.fn(() => 'consume') }));
vi.mock('../action-types/action-drop.js', () => ({ executeDrop: vi.fn(() => 'drop') }));
vi.mock('../action-types/action-split.js', () => ({ executeSplit: vi.fn(() => 'split') }));
vi.mock('../action-types/action-stack-all.js', () => ({
  executeStackAll: vi.fn(() => 'stackAll'),
}));
vi.mock('../action-types/action-wait.js', () => ({ executeWait: vi.fn(() => 'wait') }));
vi.mock('../action-types/action-throw.js', () => ({ executeThrow: vi.fn(() => 'throw') }));
vi.mock('../action-types/action-attack.js', () => ({ executeAttack: vi.fn(() => 'attack') }));
vi.mock('../action-types/action-look.js', () => ({ executeLookAt: vi.fn(() => 'lookAt') }));
vi.mock('../action-types/action-shout.js', () => ({ executeShout: vi.fn(() => 'shout') }));

import { executeMove } from '../action-types/action-move.js';
import { executeInteract } from '../action-types/action-interact.js';
import { executePickup } from '../action-types/action-pickup.js';
import { executeSelfInteract } from '../action-types/action-self-interact.js';
import { executeEquip } from '../action-types/action-equip.js';
import { executeUnequip } from '../action-types/action-unequip.js';
import { executeConsume } from '../action-types/action-consume.js';
import { executeDrop } from '../action-types/action-drop.js';
import { executeSplit } from '../action-types/action-split.js';
import { executeStackAll } from '../action-types/action-stack-all.js';
import { executeWait } from '../action-types/action-wait.js';
import { executeThrow } from '../action-types/action-throw.js';
import { executeAttack } from '../action-types/action-attack.js';
import { executeLookAt } from '../action-types/action-look.js';
import { executeShout } from '../action-types/action-shout.js';
import { createActionSystem } from './action-system.js';

const level = { id: 'level' };
const registry = { id: 'registry' };
const dialogController = { id: 'dialog' };
const entity = { id: 42 };

let executeAction;
beforeEach(() => {
  vi.clearAllMocks();
  ({ executeAction } = createActionSystem({ level, registry, dialogController }));
});

// [type, handler mock, ctx args expected after (entity, action)]
const ROUTES = [
  ['move', executeMove, [level, registry]],
  ['interact', executeInteract, [level, registry, dialogController]],
  ['pickup', executePickup, [level, registry]],
  ['selfInteract', executeSelfInteract, [level, registry, dialogController]],
  ['equip', executeEquip, [level, registry]],
  ['unequip', executeUnequip, [level, registry]],
  ['consume', executeConsume, [level, registry]],
  ['drop', executeDrop, [level, registry]],
  ['split', executeSplit, [level, registry]],
  ['stackAll', executeStackAll, [level, registry]],
  ['throw', executeThrow, [level, registry]],
  ['attack', executeAttack, [level, registry]],
  ['lookAt', executeLookAt, [level]], // no registry
  ['shout', executeShout, [level, registry]],
];

describe('action-system dispatch', () => {
  it.each(ROUTES)(
    'routes "%s" to its handler with (entity, action, ...ctx)',
    async (type, handler, ctx) => {
      const action = { type, marker: type };
      const result = await executeAction(entity, action);
      expect(handler).toHaveBeenCalledWith(entity, action, ...ctx);
      expect(result).toBe(type); // the handler's return propagates
      for (const [, other] of ROUTES) if (other !== handler) expect(other).not.toHaveBeenCalled();
    },
  );

  it('routes "wait" to executeWait (no per-turn args)', async () => {
    await executeAction(entity, { type: 'wait' });
    expect(executeWait).toHaveBeenCalledWith();
  });

  it('returns false for an unknown action type', async () => {
    expect(await executeAction(entity, { type: 'nonsense' })).toBe(false);
  });

  it('returns false for a null action', async () => {
    expect(await executeAction(entity, null)).toBe(false);
  });
});
