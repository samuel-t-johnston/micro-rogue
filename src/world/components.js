// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.

export const components = {
  position(x, y) {
    return { x, y };
  },

  name(str) {
    return str;
  },

  turnTaker(speed = 1) {
    return { speed, accumulator: 0 };
  },

  blocksMovement() {
    return {};
  },

  opaque() {
    return {};
  },

  // sprite: { col, row } matching the sprite sheet; color: CSS fallback if sprite unavailable
  renderable(sprite, color) {
    return { sprite, color };
  },

  playerControlled() {
    return {};
  },

  memory(initial = {}) {
    return { ...initial };
  },

  health(current, max) {
    return { current, max };
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
};
