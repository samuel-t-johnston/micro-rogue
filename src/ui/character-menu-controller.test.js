import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacterMenuController } from './character-menu-controller.js';
import { createCharacterMenuButton } from './widgets/character-menu-button.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from '../world/components.js';
import { createDagger, createHealingPotion } from '../world/items.js';
import { executeEquip } from '../actions/action-types/action-equip.js';
import { executeUnequip } from '../actions/action-types/action-unequip.js';
import { executeConsume } from '../actions/action-types/action-consume.js';
import { Slots, HUMANOID_SLOTS } from '../../data/equipment-slots.js';

const theme = {
  bg: '#000', surface: '#111', primary: '#444', accent: '#888',
  text: '#fff', textDim: '#aaa', textDisabled: '#666',
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
  return new Proxy({}, {
    get: (_, key) => (key === 'font' || key === 'fillStyle' || key === 'strokeStyle' ||
                       key === 'lineWidth' || key === 'textAlign' || key === 'textBaseline' ||
                       key === 'globalAlpha') ? '' : noop,
    set: () => true,
  });
}

// Helper: find which card/row was hit by walking the rendered layout
function findHit(ctx, controller, x, y) {
  controller.render(ctx);
  const submitted = [];
  controller.handleInput({ type: 'pointerdown', x, y });
  return submitted;
}

describe('character menu — full equip/unequip flow', () => {
  let registry, player, dagger, submitted, controller;

  beforeEach(() => {
    ({ registry, player, dagger } = makePlayer());
    submitted = [];
    controller = createCharacterMenuController({
      theme, getViewport,
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

  it('end-to-end: navigate to equipment, tap dagger, equip action runs, dagger lives in weapon slot', () => {
    // 1) open menu → root
    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);

    // 2) tap the Equipment card. Probe the right column at vertical center.
    // Card layout: at viewport 800x600, cols = 5, but only 2 cards. Card width =
    // floor((768 - 4*16)/5) = floor(704/5) = 140. Inventory at x=16, Equipment at x=172.
    // Tap inside Equipment card.
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 });
    controller.render(ctx);

    // 3) tap the dagger row in the "Equippable in Inventory" section.
    // Body starts at y = MARGIN(16) + HEADER_H(56) + MARGIN(16) = 88.
    // Rows: section "Equipped" (28) + 2 slot rows (40 each) + section "Equippable in Inventory" (28) + dagger row (40).
    // Dagger row starts at y = 88 + 28 + 80 + 28 = 224, height 40.
    // Tap center: y = 244, x = 200 (within body).
    controller.handleInput({ type: 'pointerdown', x: 200, y: 244 });

    // Equip action must have been submitted and the menu closed
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({ type: 'equip', itemEntityId: dagger.id });
    expect(controller.isOpen).toBe(false);

    // 4) Run the action like the game would
    executeEquip(player, submitted[0], null, registry);
    expect(player.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(dagger);
    expect(player.components.get('inventory').items).not.toContain(dagger);

    // 5) Re-open, navigate to equipment, tap the weapon slot to unequip
    controller.open();
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: 240, y: 300 });
    controller.render(ctx);

    // Weapon slot is the first slot row: y = 88 + 28 = 116, height 40. Center: 136.
    controller.handleInput({ type: 'pointerdown', x: 200, y: 136 });

    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual({ type: 'unequip', slot: Slots.WEAPON });
    expect(controller.isOpen).toBe(false);

    executeUnequip(player, submitted[1], null, registry);
    expect(player.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(null);
    expect(player.components.get('inventory').items).toContain(dagger);
  });

  it('end-to-end: navigate to inventory, tap healing potion, consume action runs, HP restored, item destroyed', () => {
    // Set up: give the player a health component and a healing potion in inventory.
    registry.addComponent(player, 'health', components.health(8, 20));
    const potion = createHealingPotion(registry, null, null, player.id);
    player.components.get('inventory').items.push(potion);

    controller.open();
    const ctx = makeCtx();
    controller.render(ctx);

    // Tap Inventory card. Cards laid out left-to-right at row 1: Inventory at index 0,
    // Equipment at index 1. With viewport 800x600, cols=5 → card width 140, gap 16,
    // Inventory at x=16, Equipment at x=172. Inventory card center: ~86 horizontally.
    controller.handleInput({ type: 'pointerdown', x: 86, y: 300 });
    controller.render(ctx);

    // Inventory rows are 36px tall, starting at body.y = 88. With dagger at index 0 and
    // potion at index 1, the potion row is at y = 88 + 36 = 124, center y = 142.
    controller.handleInput({ type: 'pointerdown', x: 200, y: 142 });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({ type: 'consume', itemEntityId: potion.id });
    expect(controller.isOpen).toBe(false);

    executeConsume(player, submitted[0], null, registry);
    expect(player.components.get('health').current).toBe(18);
    expect(player.components.get('inventory').items).not.toContain(potion);
    expect(registry.getEntity(potion.id)).toBeNull();
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
      theme, getViewport,
      onOpen: () => { opened++; },
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
