/**
 * Mulberry32 PRNG — single shared instance.
 * @see https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */

let _seed = 0;
let _state = 0;

/** Advances the state and returns the next float in [0, 1). */
function advance() {
  _state = (_state + 0x6D2B79F5) >>> 0;
  let t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const rng = {
  /** @param {number} [seed] - Generates a random seed if omitted. */
  init(seed) {
    _seed = seed !== undefined ? seed >>> 0 : (Math.random() * 0x100000000) >>> 0;
    _state = _seed;
  },

  getSeed() { return _seed; },
  getState() { return _state; },

  setState(state) { _state = state >>> 0; },

  random() { return advance(); },

  /** Returns an integer in [min, max). */
  nextInt(min, max) { return Math.floor(advance() * (max - min)) + min; },

  pick(arr) { return arr[Math.floor(advance() * arr.length)]; },
};
