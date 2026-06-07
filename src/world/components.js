// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.
// Add new components in alphabetical order and keep them sorted.
import { RenderLayers } from '../render/render-layers.js';

export const components = {
  // Ordered goal stack for an active entity. Stored as string keys resolved through
  // src/ai/goals/goal-registry.js — never function references — so the component
  // serializes cleanly. Order is priority: the evaluator runs goals top-down and
  // takes the first one that produces an action.
  ai(goalNames = []) {
    return { goals: [...goalNames] };
  },

  // Marks an entity as able to take the attack action. `damage` is the unarmed/base
  // attack damage; equipment and effects add to it via attributeModifiers (see the
  // attribute resolver in src/combat/attributes.js).
  attacker(damage = 0) {
    return { damage };
  },

  // Flat stat contributions a worn/held item grants its owner. Keys are attribute names
  // (currently 'attackDamage' and 'HP') summed by the attribute resolver. Stored as data
  // so items serialize cleanly; the resolver derives totals on demand — values are never
  // added to or subtracted from the owner's stored stats on equip/unequip.
  attributeModifiers(mods = {}) {
    return { ...mods };
  },

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

  // One or more faction tags. Two entities are friendly if they share at least one tag;
  // hostility (no shared tag) is computed by areHostile in src/combat/factions.js.
  // A factionless entity shares nothing, so it reads as hostile to everyone.
  faction(names = []) {
    return [...names];
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

  // Ordered list of sense names resolved through src/ai/senses/sense-registry.js.
  // Stored as string keys (not function references) so the component serializes cleanly.
  // Each resolved sense is sense(entity, level, turnCount) → SenseResult.
  senses(senseNames = []) {
    return [...senseNames];
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
