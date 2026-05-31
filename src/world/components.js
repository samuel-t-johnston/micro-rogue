// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.

export const components = {
  position(x, y) {
    return { x, y };
  },

  turnTaker(speed = 1) {
    return { speed, accumulator: 0 };
  },

  blockMovement() {
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

  // Array of sense functions: sense(entity, level, turnCount) → SenseResult[].
  // Stored as function references — never serialized.
  senses(fns = []) {
    return [...fns];
  },
};
