import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { gameLog } from '../../engine/log/game-log.js';
import { buildSupportBundle, SUPPORT_BUNDLE_VERSION } from './support-bundle.js';
import { GAME_VERSION } from '../core/save-system.js';

function makeGame() {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.width = 3;
  level.height = 3;
  level.tiles = [
    ['floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor'],
  ];
  const player = registry.createEntity();
  registry.addComponent(player, 'position', components.position(1, 1));
  registry.addComponent(player, 'playerControlled', components.playerControlled());
  registry.addComponent(player, 'attributes', components.attributes({ hp: 20, con: 20 }));
  level.placeEntity(player);
  return { registry, level, player };
}

describe('buildSupportBundle', () => {
  beforeEach(() => gameLog.reset());

  it('wraps the live save snapshot, the event log, and device info', () => {
    const { registry, level, player } = makeGame();
    gameLog.add({ display: 'You enter the dungeon.' });

    const bundle = buildSupportBundle({ registry, level, player, turnCount: 5 });

    expect(bundle.bundleVersion).toBe(SUPPORT_BUNDLE_VERSION);
    expect(bundle.gameVersion).toBe(GAME_VERSION);
    expect(Number.isNaN(Date.parse(bundle.generatedAt))).toBe(false);

    // Save snapshot comes straight from serializeGame.
    expect(bundle.save.playerId).toBe(player.id);
    expect(bundle.save.meta.turnCount).toBe(5);
    expect(Array.isArray(bundle.save.entities)).toBe(true);

    // Full event log, not just display lines.
    expect(bundle.log).toHaveLength(1);
    expect(bundle.log[0].display).toBe('You enter the dungeon.');

    // Device readout present (happy-dom provides a userAgent and viewport).
    expect(bundle.device).toHaveProperty('userAgent');
    expect(bundle.device.viewport).toBeTypeOf('object');
  });

  it('is JSON-serializable with no Maps/Sets leaking through', () => {
    const { registry, level, player } = makeGame();
    const bundle = buildSupportBundle({ registry, level, player, turnCount: 0 });
    expect(() => JSON.stringify(bundle)).not.toThrow();
    const round = JSON.parse(JSON.stringify(bundle));
    expect(round.save.playerId).toBe(player.id);
  });
});
