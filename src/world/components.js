// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.
// Add new components in alphabetical order and keep them sorted.
export const components = {
  blocksMovement() {
    return {};
  },

  container() {
    return {};
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
  renderable(sprite, color, glyph, glyphColor) {
    return { sprite, color, glyph, glyphColor };
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
};
