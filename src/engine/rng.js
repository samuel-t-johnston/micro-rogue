/**
 * Seeded RNG. A single master seed yields independent streams, each derived by name, so
 * unrelated concerns never perturb one another's sequences. See docs/design/rng-and-determinism.md.
 *
 * The underlying generator is Mulberry32.
 * @see https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */

// --- mixing primitives ---

/** FNV-1a hash of a string to a uint32 — folds stream names into seeds. */
export function hashName(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// splitmix32 finalizer — avalanches a single 32-bit word.
function mix32(x) {
  x = (x + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

/** Folds a master seed and ordered integer parts into a derived stream seed. */
export function deriveSeed(master, ...parts) {
  let h = master >>> 0;
  for (const p of parts) h = mix32((h ^ (p >>> 0)) >>> 0);
  return h >>> 0;
}

function randomSeed() {
  return (Math.random() * 0x100000000) >>> 0;
}

// Coerces a mix argument to a uint32: numbers used directly, strings hashed.
function toUint32(v) {
  return typeof v === 'string' ? hashName(v) : (v >>> 0);
}

// --- a single stream ---

/**
 * Creates an independent Mulberry32 stream.
 * @param {number} [seed] - Generates a random seed if omitted.
 */
export function createRng(seed) {
  const _seed = seed !== undefined ? seed >>> 0 : randomSeed();
  let _state = _seed;

  function advance() {
    _state = (_state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    getSeed() { return _seed; },
    getState() { return _state; },
    setState(state) { _state = state >>> 0; },
    random() { return advance(); },
    /** Returns an integer in [min, max). */
    nextInt(min, max) { return Math.floor(advance() * (max - min)) + min; },
    pick(arr) {
      if (arr.length === 0) throw new Error('rng.pick called with empty array');
      return arr[Math.floor(advance() * arr.length)];
    },
  };
}

// --- the service: a master seed and its named streams ---

/**
 * Owns a master seed and hands out streams derived from it.
 * - `stream(name)` — persistent, cached; its state belongs in the save.
 * - `derive(name, ...mix)` — a pure function of (master, name, ...mix) → a fresh RNG, used
 *   and discarded, never saved (re-derivable from its key). Map generation lives here.
 * @param {number} [masterSeed] - Generates a random master if omitted.
 */
export function createRngService(masterSeed) {
  const _master = masterSeed !== undefined ? masterSeed >>> 0 : randomSeed();
  const streams = new Map(); // name -> persistent rng instance

  return {
    getMasterSeed() { return _master; },

    stream(name) {
      let s = streams.get(name);
      if (!s) {
        s = createRng(deriveSeed(_master, hashName(name)));
        streams.set(name, s);
      }
      return s;
    },

    derive(name, ...mix) {
      return createRng(deriveSeed(_master, hashName(name), ...mix.map(toUint32)));
    },

    // Save shape: { seed, streams: { name: state } } for instantiated persistent streams only.
    snapshot() {
      const out = {};
      for (const [name, s] of streams) out[name] = s.getState();
      return { seed: _master, streams: out };
    },

    // Restores instantiated streams' states (the master is fixed at construction).
    restore(snapshot) {
      for (const [name, state] of Object.entries(snapshot?.streams ?? {})) {
        this.stream(name).setState(state);
      }
    },
  };
}

// --- ambient singleton: the gameplay façade ---
// Most call sites just want "the game's RNG" without threading a service around — they read
// the current world's persistent `gameplay` stream. Generation and the save system reach for
// the richer API (deriveRng / snapshot / restore).

let _service = createRngService();

export const rng = {
  /** Starts a new world with the given master seed (random if omitted). */
  init(seed) { _service = createRngService(seed); },

  getMasterSeed() { return _service.getMasterSeed(); },

  /** A named persistent stream whose state is carried in the save (gameplay is the default one). */
  stream(name) { return _service.stream(name); },

  /** A fresh, re-derivable stream keyed by name + mix inputs (e.g. map generation). */
  deriveRng(name, ...mix) { return _service.derive(name, ...mix); },

  /** Persistent-stream states for the save: { seed, streams }. */
  snapshot() { return _service.snapshot(); },

  /** Rebuilds the world from a snapshot ({ seed, streams }). */
  restore(snapshot) {
    _service = createRngService(snapshot.seed);
    _service.restore(snapshot);
  },

  // Gameplay-stream consumption — the common case.
  random() { return _service.stream('gameplay').random(); },
  nextInt(min, max) { return _service.stream('gameplay').nextInt(min, max); },
  pick(arr) { return _service.stream('gameplay').pick(arr); },
};
