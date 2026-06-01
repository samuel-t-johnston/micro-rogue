// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.

export const components = {
  blocksMovement() {
    return {};
  },

  health(current, max) {
    return { current, max };
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
