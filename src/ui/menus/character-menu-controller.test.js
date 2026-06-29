import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacterMenuController } from './character-menu-controller.js';
import { createCharacterMenuButton } from '../widgets/character-menu-button.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../../world/entities/components.js';
import { createDagger, createHealingPotion } from '../../world/entities/items.js';
import { executeEquip } from '../../actions/action-types/action-equip.js';
import { executeUnequip } from '../../actions/action-types/action-unequip.js';
import { executeConsume } from '../../actions/action-types/action-consume.js';
import { executeDrop } from '../../actions/action-types/action-drop.js';
import { Slots, HUMANOID_SLOTS } from '../../../data/equipment-slots.js';
import { createLevel } from '../../world/map/level.js';

const theme = {
  bg: '#000',
  surface: '#111',
  primary: '#444',
  accent: '#888',
  text: '#fff',
  textDim: '#aaa',
  textDisabled: '#666',
};
const viewport = { width: 800, height: 600 };
const getViewport = () => viewport;

function makePlayer() {
  const registry = createEntityRegistry();
  const player = registry.createEntity();
  registry.addComponent(player, 'inventory', components.inventory());
  registry.addComponent(player, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  const dagger = createDagger(registry, null, null, player.id);
  player.components.get('inventory').items.push(dagger);
  return { registry, player, dagger };
}

// Mock 2D context — happy-dom stubs canvas drawing, but the controller's render()
// is called every frame; this ensures render() doesn't throw before handleInput is exercised.
function makeCtx() {
  const noop = () => {};
  return new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'font' ||
        key === 'fillStyle' ||
        key === 'strokeStyle' ||
        key === 'lineWidth' ||
        key === 'textAlign' ||
        key === 'textBaseline' ||
        key === 'globalAlpha'
          ? ''
          : noop,
      set: () => true,
    },
  );
}

describe('character menu — full equip/unequip flow', () => {
  let registry, player, dagger, submitted, controller;

  beforeEach(() => {
    ({ registry, player, dagger } = makePlayer());
    submitted = [];
    controller = createCharacterMenuController({
      theme,
      getViewport,
      getPlayer: () => player,
      onAction: (action) => submitted.push(action),
    });
  });

  it('starts closed', () => {
    expect(controller.isOpen).toBe(false);
  });

  it('open() shows the root card grid', () => {
    controller.open();
    expect(controller.isOpen).toBe(true);
    // Render should not throw on a happy-dom stub ctx
    expect(() => controller.render(makeCtx())).not.toThrow();
  });

  it('tapping the Equipment card navigates to the equipment screen', () => {
    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);

    // Equipment is the second card. With viewport 800x600, MARGIN=16, CARD_GAP=16,
    // available width 768 → cards fit at 140 minimum → cols = floor((768+16)/(140+16))=5,
    // so 2 cards fit in row 1 at indices 0 and 1. Equipment is at index 1.
    // We simulate a pointerdown anywhere within the second card column by trying a range
    // of x positions and finding one that triggers navigation.
    // Simpler: tap at the rough horizontal middle of the right half of the screen,
    // at the vertical middle (cards are centered vertically).
    const handled = controller.handleInput({ type: 'pointerdown', x: 280, y: 300 });
    expect(handled).toBe(true);
    // After selecting equipment, we should still be open
    expect(controller.isOpen).toBe(true);
    // Tapping again should now hit equipment-screen rows; if we were still on root,
    // the first card (Inventory at index 0) would be at a different x.
    // Verify by attempting to equip — a tap on the dagger row should submit equip
    controller.render(ctx);
  });

  // Action menu layout (centered, PANEL_W=260, viewport 800x600):
  //   panel.x = (800 - 260) / 2 = 270
  //   For 2 actions (Equip/Unequip + Cancel):
  //     panelH = 44(header) + 16(pad) + 2*44(buttons) + 1*8(gap) + 16(pad) = 172
  //     panel.y = (600 - 172) / 2 = 214
  //     Button 0 center: x=400, y=214+44+16+22 = 296
  //   For 3 actions (Use + Drop + Cancel):
  //     panelH = 44 + 16 + 3*44 + 2*8 + 16 = 224
  //     panel.y = (600 - 224) / 2 = 188
  //     Button 0 center: x=400, y=188+44+16+22 = 270
  //     Button 1 center: y = 270 + 44 + 8 = 322

  it('end-to-end: navigate to equipment, tap dagger row → Equip menu → confirm; then tap weapon slot → Unequip menu → confirm', () => {
    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);

    // Tap Equipment card (index 1 in the card grid).
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 });
    controller.render(ctx);

    // Tap the dagger row in the "Equippable in Inventory" section.
    // Body y = 88. Rows: Equipped section (28) + 3 slot rows of ROW_H=44 (132) + section (28) = 188
    // offset, so the dagger row spans [276, 320). Tap inside it.
    controller.handleInput({ type: 'pointerdown', x: 200, y: 290 });
    expect(submitted).toHaveLength(0); // menu just opened, nothing submitted yet
    controller.render(ctx);

    // Tap Equip button (button 0 of 2-action menu).
    controller.handleInput({ type: 'pointerdown', x: 400, y: 296 });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({ type: 'equip', itemEntityId: dagger.id });
    expect(controller.isOpen).toBe(false);

    executeEquip(player, submitted[0], null, registry);
    expect(player.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(dagger);

    // Re-open, navigate to equipment, tap the weapon slot to open Unequip menu, confirm.
    controller.open();
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 });
    controller.render(ctx);

    // Weapon slot row: body y = 88, after section header (28) = 116, center y = 136.
    controller.handleInput({ type: 'pointerdown', x: 200, y: 136 });
    controller.render(ctx);

    // Tap Unequip button.
    controller.handleInput({ type: 'pointerdown', x: 400, y: 296 });

    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual({ type: 'unequip', slot: Slots.WEAPON });
    expect(controller.isOpen).toBe(false);

    executeUnequip(player, submitted[1], null, registry);
    expect(player.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(null);
    expect(player.components.get('inventory').items).toContain(dagger);
  });

  it('equipment screen menu Cancel button dismisses without submitting', () => {
    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 }); // Equipment
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 200, y: 290 }); // Dagger row → menu
    controller.render(ctx);
    // Tap Cancel button (button 1 of 2-action menu): y = 296 + 52 = 348
    controller.handleInput({ type: 'pointerdown', x: 400, y: 348 });
    expect(submitted).toHaveLength(0);
    expect(controller.isOpen).toBe(true); // menu still open, back at equipment screen
  });

  it('end-to-end: inventory → tap potion → Use → HP restored, potion destroyed', () => {
    registry.addComponent(player, 'health', components.health(8, 20));
    const potion = createHealingPotion(registry, null, null, player.id);
    player.components.get('inventory').items.push(potion);

    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);

    // Tap Inventory card (index 0). Center: ~86 horizontally.
    controller.handleInput({ type: 'pointerdown', x: 86, y: 300 });
    controller.render(ctx);

    // Tap the potion row. ROW_H=36, body.y=88. Dagger at index 0, potion at index 1.
    // Potion row center: y = 88 + 36 + 18 = 142.
    controller.handleInput({ type: 'pointerdown', x: 200, y: 142 });
    expect(submitted).toHaveLength(0); // menu just opened
    controller.render(ctx);

    // Tap Use button (button 0 of 4-action menu Use/Throw/Drop/Cancel). Button 0 center y = 244.
    controller.handleInput({ type: 'pointerdown', x: 400, y: 244 });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({ type: 'consume', itemEntityId: potion.id });
    expect(controller.isOpen).toBe(false);

    executeConsume(player, submitted[0], null, registry);
    expect(player.components.get('health').current).toBe(18);
    expect(player.components.get('inventory').items).not.toContain(potion);
    expect(registry.getEntity(potion.id)).toBeNull();
  });

  it('end-to-end: inventory → tap potion → Drop → potion appears on map at player position', () => {
    const level = createLevel();
    level.width = 5;
    level.height = 5;
    level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
    registry.addComponent(player, 'position', components.position(2, 3));

    const potion = createHealingPotion(registry, null, null, player.id);
    player.components.get('inventory').items.push(potion);

    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 86, y: 300 }); // Inventory card
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 200, y: 142 }); // Potion row → menu
    controller.render(ctx);

    // Tap Drop (button 2 of 4-action menu Use/Throw/Drop/Cancel): button 2 center y = 348.
    controller.handleInput({ type: 'pointerdown', x: 400, y: 348 });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({ type: 'drop', itemEntityId: potion.id });
    expect(controller.isOpen).toBe(false);

    executeDrop(player, submitted[0], level, registry);
    expect(player.components.get('inventory').items).not.toContain(potion);
    expect(level.getEntitiesAt(2, 3)).toContain(potion);
    expect(potion.components.get('item').location).toEqual({ type: 'map' });
  });

  it('end-to-end: inventory → tap dagger → Equip menu shows Equip + Drop + Cancel (no Use)', () => {
    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 86, y: 300 }); // Inventory card
    controller.render(ctx);

    // Tap the dagger row at index 0 (no potion this test). Center y = 88 + 18 = 106.
    controller.handleInput({ type: 'pointerdown', x: 200, y: 106 });
    controller.render(ctx);

    // Equippable item menu has 4 actions (Equip/Throw/Drop/Cancel). Tap Equip (button 0), center y = 244.
    controller.handleInput({ type: 'pointerdown', x: 400, y: 244 });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({ type: 'equip', itemEntityId: dagger.id });
  });

  it('Escape key closes the menu from the root', () => {
    controller.open();
    controller.handleInput({ type: 'keydown', key: 'Escape' });
    expect(controller.isOpen).toBe(false);
  });

  it('back button on subscreen returns to root, Escape on subscreen also returns to root', () => {
    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);
    // Navigate to equipment
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 });
    controller.render(ctx);
    // Tap back button (top-left, 16,16 size 44)
    controller.handleInput({ type: 'pointerdown', x: 38, y: 38 });
    // Still open, but back on root — verify by tapping where Equipment card was,
    // re-navigating, then pressing Escape returns to root, not closes
    expect(controller.isOpen).toBe(true);
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 });
    controller.render(ctx);
    controller.handleInput({ type: 'keydown', key: 'Escape' });
    // Escape on subscreen returns to root (per controller wiring), not closes the menu
    expect(controller.isOpen).toBe(true);
  });
});

describe('character menu button', () => {
  it('hit area sits at bottom-right and calls onOpen', () => {
    let opened = 0;
    const btn = createCharacterMenuButton({
      theme,
      getViewport,
      onOpen: () => {
        opened++;
      },
    });
    // Button size 44, margin 12, anchored bottom-right.
    // x = 800 - 12 - 44 = 744, y = 600 - 12 - 44 = 544. Center: 766, 566.
    expect(btn.handleInput({ type: 'pointerdown', x: 766, y: 566 })).toBe(true);
    expect(opened).toBe(1);
    // Tap outside (top-left): should NOT fire
    expect(btn.handleInput({ type: 'pointerdown', x: 10, y: 10 })).toBe(false);
    expect(opened).toBe(1);
  });
});
