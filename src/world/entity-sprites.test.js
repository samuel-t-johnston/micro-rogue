import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { SPRITES } from '../../data/sprites/sprite-catalog.js';
import terrain from '../../data/tiles/terrain.js';
import { PLAYER_SAMPLE } from './player.js';
import { ENTITY_PREFABS } from './entity-prefabs.js';

// Every visible entity must carry BOTH a glyph (ASCII mode and the sprite-unavailable fallback) and
// a sprite name that resolves in the catalog (sprite mode). This is the gate for "all visible
// entities have glyphs and sprites" — it stays red until each new sprite name has catalog
// coordinates. See docs/howto/sprite-sheets.md.
//
// Every spawnable type is enumerated straight from ENTITY_PREFABS, so a newly-added creature/item/
// furniture is covered automatically once it's registered there — no separate list to maintain here.
// The player isn't a prefab (not map-spawnable), so it's folded in via PLAYER_SAMPLE.
const factories = {
  ...PLAYER_SAMPLE,
  ...Object.fromEntries(
    Object.keys(ENTITY_PREFABS).map((id) => [id, (r) => ENTITY_PREFABS[id].make(r, 0, 0)]),
  ),
};

describe('entity sprites + glyphs', () => {
  for (const [label, make] of Object.entries(factories)) {
    it(`${label} has a glyph and a resolvable sprite`, async () => {
      const entity = await make(createEntityRegistry());
      const r = entity.components.get('renderable');
      expect(r.glyph, `${label} is missing a glyph`).toBeTruthy();
      expect(
        SPRITES[r.sprite],
        `${label} sprite "${r.sprite}" is not in the catalog`,
      ).toBeDefined();
      // In glyph/ASCII mode the glyph is drawn on a fill of the same `color`; identical values make
      // it invisible. Require the glyph color to differ from the cell color.
      expect(
        r.glyphColor,
        `${label} glyph color matches its cell color (invisible in ASCII mode)`,
      ).not.toBe(r.color);
    });
  }

  for (const [id, tile] of Object.entries(terrain)) {
    it(`terrain ${id} has a glyph and a resolvable sprite`, () => {
      expect(tile.glyph, `terrain ${id} is missing a glyph`).toBeTruthy();
      expect(
        SPRITES[tile.sprite],
        `terrain ${id} sprite "${tile.sprite}" is not in the catalog`,
      ).toBeDefined();
      expect(
        tile.glyphColor,
        `terrain ${id} glyph color matches its cell color (invisible in ASCII mode)`,
      ).not.toBe(tile.color);
    });
  }
});
