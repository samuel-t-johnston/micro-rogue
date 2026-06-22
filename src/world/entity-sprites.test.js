import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { SPRITES } from '../../data/sprites/sprite-catalog.js';
import terrain from '../../data/tiles/terrain.js';
import { createPlayer } from './player.js';
import { createGoblin, createOrc, createOrcCommander, createScuttler } from './creatures.js';
import {
  createHealingPotion, createPotionOfPain, createDagger, createSword,
  createLeatherArmor, createAmulet, createScroll,
} from './items.js';
import { createBoulder, createChest, createStairs, createDoor, createDungeonExit } from './furniture.js';

// Every visible entity must carry BOTH a glyph (ASCII mode and the sprite-unavailable fallback) and
// a sprite name that resolves in the catalog (sprite mode). This is the gate for "all visible
// entities have glyphs and sprites" — it stays red until each new sprite name has catalog
// coordinates. See docs/howto/sprite-sheets.md.
const factories = {
  player: (r) => createPlayer(r, 0, 0),
  goblin: (r) => createGoblin(r, 0, 0),
  orc: (r) => createOrc(r, 0, 0),
  'orc commander': (r) => createOrcCommander(r, 0, 0),
  scuttler: (r) => createScuttler(r, 0, 0),
  'healing potion': (r) => createHealingPotion(r, 0, 0),
  'potion of pain': (r) => createPotionOfPain(r, 0, 0),
  dagger: (r) => createDagger(r, 0, 0),
  sword: (r) => createSword(r, 0, 0),
  'leather armor': (r) => createLeatherArmor(r, 0, 0),
  amulet: (r) => createAmulet(r, 0, 0),
  scroll: (r) => createScroll(r, 0, 0),
  boulder: (r) => createBoulder(r, 0, 0),
  chest: (r) => createChest(r, 0, 0),
  'stairs up': (r) => createStairs(r, 0, 0, 'up'),
  'stairs down': (r) => createStairs(r, 0, 0, 'down'),
  door: (r) => createDoor(r, 0, 0),
  'dungeon exit': (r) => createDungeonExit(r, 0, 0),
};

describe('entity sprites + glyphs', () => {
  for (const [label, make] of Object.entries(factories)) {
    it(`${label} has a glyph and a resolvable sprite`, async () => {
      const entity = await make(createEntityRegistry());
      const r = entity.components.get('renderable');
      expect(r.glyph, `${label} is missing a glyph`).toBeTruthy();
      expect(SPRITES[r.sprite], `${label} sprite "${r.sprite}" is not in the catalog`).toBeDefined();
    });
  }

  for (const [id, tile] of Object.entries(terrain)) {
    it(`terrain ${id} has a glyph and a resolvable sprite`, () => {
      expect(tile.glyph, `terrain ${id} is missing a glyph`).toBeTruthy();
      expect(SPRITES[tile.sprite], `terrain ${id} sprite "${tile.sprite}" is not in the catalog`).toBeDefined();
    });
  }
});
