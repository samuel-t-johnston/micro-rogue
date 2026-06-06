// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.
// Add new components in alphabetical order and keep them sorted.
import { RenderLayers } from '../render/render-layers.js';

export const components = {
  blocksMovement() {
    return {};
  },

  container() {
    return {};
  },

  // Marks an entity as consumable (drinkable/edible/readable). The item is destroyed on use.
  // effectType is a string key into the effects registry (src/effects/effects.js);
  // params is the effect-specific payload, e.g. { amount: 10 } for heal/damage.
  // Storing the type+params as data (not a function ref) so consumables serialize cleanly.
  consumable(effectType, params = {}) {
    return { effectType, params };
  },

  // Marks an entity as equippable in a named slot. Slot names come from data/equipment-slots.js
  // (the Slots enum) — never bare strings — so typos crash at import time.
  // Kept separate from `item` so non-item things (future spells, innate abilities) can also be equipped.
  equippable(slot) {
    return { slot };
  },

  health(current, max) {
    return { current, max };
  },

  inventory(items = []) {
    return { items };
  },

  // location: { type: 'map' } | { type: 'inventory', ownerId } | { type: 'equipped', ownerId, slot } | { type: 'container', containerId }
  // Map items also carry a position component; the other types do not.
  item(location) {
    return { location };
  },

  memory(initial = {}) {
    return { ...initial };
  },

  name(str) {
    return str;
  },

  opaque() {
    return {};
  },

  // This is currently used for furniture like doors. For furniture with inventories 
  // (e.g. chests), use the container and inventory components instead.
  // isOpen: current state. closedSprite/openSprite: { col, row } swapped on open/close.
  openable(closedSprite, openSprite) {
    return { isOpen: false, closedSprite, openSprite };
  },

  playerControlled() {
    return {};
  },

  position(x, y) {
    return { x, y };
  },

  // sprite: { col, row } matching the sprite sheet; color: CSS fallback if sprite unavailable.
  // glyph/glyphColor: optional text character drawn over the tile when no sprite is available.
  // layer: z-order from src/render/render-layers.js — lower draws first. Omitting it
  // falls back to RenderLayers.DEFAULT (creatures, furniture); items override to ITEM
  // so a creature standing on a dropped item draws on top.
  renderable(sprite, color, glyph, glyphColor, layer = RenderLayers.DEFAULT) {
    return { sprite, color, glyph, glyphColor, layer };
  },

  // Array of sense functions: sense(entity, level, turnCount) → SenseResult[].
  // Stored as function references — never serialized.
  senses(fns = []) {
    return [...fns];
  },

  // Tile-level perception. visible: tiles seen this turn. memory: all ever-seen tiles → tileId.
  // Goals may read memory for navigation; renderer uses both for fog-of-war display.
  tilePerception() {
    return {
      visible: new Set(),
      memory: new Map(),
    };
  },

  turnTaker(speed = 1) {
    return { speed, accumulator: 0 };
  },

  // An entity that wears equipment. slotNames defines the named slots available on this entity.
  // Slots hold either an entity reference or null.
  wearsEquipment(slotNames = []) {
    const slots = {};
    for (const name of slotNames) slots[name] = null;
    return { slots };
  },
};
