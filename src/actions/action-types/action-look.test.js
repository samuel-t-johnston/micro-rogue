import { describe, it, expect, beforeEach } from 'vitest';
import { executeLookAt } from './action-look.js';
import { gameLog } from '../../engine/log/game-log.js';
import { createLevel } from '../../world/map/level.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../../world/entities/components.js';

function makeLevel(w = 5, h = 5) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

describe('executeLookAt', () => {
  let registry, level, player;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    player = registry.createEntity();
    registry.addComponent(player, 'position', components.position(2, 2));
    const tp = components.tilePerception();
    tp.visible.add('2,2');
    registry.addComponent(player, 'tilePerception', tp);
  });

  it('is a free action (returns true) so the turn is not consumed', () => {
    expect(executeLookAt(player, { type: 'lookAt', x: 2, y: 2 }, level)).toBe(true);
  });

  it('logs a player-attributed display line describing the tile', () => {
    executeLookAt(player, { type: 'lookAt', x: 2, y: 2 }, level);
    const entries = gameLog.getAll();
    const entry = entries[entries.length - 1];
    expect(entry.actor).toBe(player.id); // attributed to the player so it always surfaces
    expect(entry.display).toBe('You are standing here.');
  });

  it('reports an unseen tile as out of sight', () => {
    executeLookAt(player, { type: 'lookAt', x: 4, y: 4 }, level);
    const entries = gameLog.getAll();
    expect(entries[entries.length - 1].display).toBe("You can't see there.");
  });
});
