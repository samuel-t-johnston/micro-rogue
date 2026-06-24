import { describe, it, expect, beforeEach } from 'vitest';
import { playerAutoPickup } from './player-auto-pickup.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { createHealingPotion } from '../../world/entities/items.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

function makeContext({ x = 2, y = 2, memory = {}, hasPendingInput = false, level } = {}) {
  return {
    selfState: { position: { x, y } },
    memory,
    level,
    hasPendingInput: () => hasPendingInput,
  };
}

describe('playerAutoPickup', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
  });

  it('returns null when there is pending input', () => {
    level.placeEntity(createHealingPotion(registry, 2, 2));
    const ctx = makeContext({ hasPendingInput: true, level });
    expect(playerAutoPickup.evaluate(ctx)).toBeNull();
  });

  it('returns null when the player has not moved since last evaluation', () => {
    level.placeEntity(createHealingPotion(registry, 2, 2));
    const memory = { autoPickupLastPos: { x: 2, y: 2 } };
    const ctx = makeContext({ memory, level });
    expect(playerAutoPickup.evaluate(ctx)).toBeNull();
  });

  it('returns null when no items are at the player position', () => {
    const ctx = makeContext({ level });
    expect(playerAutoPickup.evaluate(ctx)).toBeNull();
  });

  it('returns null when multiple items are at the player position', () => {
    level.placeEntity(createHealingPotion(registry, 2, 2));
    level.placeEntity(createHealingPotion(registry, 2, 2));
    const ctx = makeContext({ level });
    expect(playerAutoPickup.evaluate(ctx)).toBeNull();
  });

  it('returns a pickup action when exactly one item is present and position changed', () => {
    const potion = createHealingPotion(registry, 2, 2);
    level.placeEntity(potion);
    const memory = { autoPickupLastPos: { x: 1, y: 2 } };
    const ctx = makeContext({ memory, level });
    expect(playerAutoPickup.evaluate(ctx)).toEqual({
      action: { type: 'pickup', itemEntityId: potion.id },
    });
  });

  it('fires on the first evaluation when no prior position is stored in memory', () => {
    const potion = createHealingPotion(registry, 2, 2);
    level.placeEntity(potion);
    const ctx = makeContext({ level });
    expect(playerAutoPickup.evaluate(ctx)).toEqual({
      action: { type: 'pickup', itemEntityId: potion.id },
    });
  });

  it('updates memory.autoPickupLastPos to the current position each evaluation', () => {
    const memory = {};
    const ctx = makeContext({ x: 3, y: 4, memory, level });
    playerAutoPickup.evaluate(ctx);
    expect(memory.autoPickupLastPos).toEqual({ x: 3, y: 4 });
  });

  it('does not fire again on the next evaluation at the same position', () => {
    const potion = createHealingPotion(registry, 2, 2);
    level.placeEntity(potion);
    const memory = {};
    const ctx = makeContext({ memory, level });

    playerAutoPickup.evaluate(ctx); // fires, sets lastPos
    expect(playerAutoPickup.evaluate(ctx)).toBeNull(); // same position → null
  });
});
