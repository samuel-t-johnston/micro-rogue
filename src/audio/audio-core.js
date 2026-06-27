/**
 * @file Private audio plumbing shared by sfx.js and music.js. Gameplay code must NOT import this —
 * it imports `sfx` and `music`. The one legitimate outside consumer is the settings glue, which uses
 * the master controls at the bottom to push persisted volume/mute values in at startup and whenever
 * the player changes them.
 *
 * Owns: the AudioContext, the master gain bus, the per-channel sub-buses (sfx, music), the
 * unlock-on-first-gesture handshake, and the master volume/mute state. Knows nothing about
 * individual sounds.
 *
 * Gain graph:
 *
 *     sfxBus  --\
 *                >-- masterGain -- destination
 *     musicBus --/
 *
 * Channel volume rides on its own bus; master rides on masterGain. The multiplication
 * (master * channel) happens in the signal path, so each setter only ever writes one node's gain.
 *
 * Everything degrades to a silent no-op when the Web Audio API is unavailable (ancient browsers,
 * server-side test runners such as happy-dom). Callers never have to guard.
 */

const AudioContextCtor =
  typeof globalThis !== 'undefined'
    ? globalThis.AudioContext || globalThis.webkitAudioContext || null
    : null;

let ctx = null; // AudioContext | null
let masterGain = null; // GainNode | null
let sfxBus = null; // GainNode | null
let musicBus = null; // GainNode | null
let initTried = false; // have we attempted to build the graph yet?
let unavailable = AudioContextCtor === null;

// Master state. Volume is the slider position (0..1); muted is independent so that unmute returns to
// the prior volume rather than to a remembered hack. Effective master gain = muted ? 0 : volume.
let masterVolume = 1;
let masterMuted = false;

// Channels register hooks that run when the graph is (re)built or reaches the running state. This is
// how a volume set *before* the lazy context exists still ends up applied, and how queued music
// starts once audio unlocks.
const readyHooks = [];
const runningHooks = [];

function applyMasterGain() {
  if (masterGain) masterGain.gain.value = masterMuted ? 0 : masterVolume;
}

function runReadyHooks() {
  for (const hook of readyHooks) {
    try {
      hook();
    } catch {
      /* one channel's hook must never break another */
    }
  }
}

function runRunningHooks() {
  for (const hook of runningHooks) {
    try {
      hook();
    } catch {
      /* ditto */
    }
  }
}

function handleStateChange() {
  if (ctx && ctx.state === 'running') runRunningHooks();
}

function buildGraph() {
  // Create the context + gain graph on demand. Safe to call repeatedly.
  if (initTried) return ctx;
  initTried = true;
  if (unavailable) return null;
  try {
    ctx = new AudioContextCtor();
  } catch {
    // Constructor present but construction threw — treat as unavailable.
    unavailable = true;
    ctx = null;
    return null;
  }
  masterGain = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(masterGain);
  musicBus.connect(masterGain);
  masterGain.connect(ctx.destination);
  applyMasterGain();
  ctx.onstatechange = handleStateChange;
  runReadyHooks(); // channels write their stored volume/mute onto the new buses
  return ctx;
}

// ---- Unlock handling -------------------------------------------------------
//
// Browsers start the AudioContext suspended until a user gesture. We resume on the first
// pointer/key/touch, opportunistically whenever a sound is requested (the request may itself be
// inside a gesture), and again on visibility regain since iOS suspends the context when the page is
// backgrounded.

let unlockInstalled = false;

function resumeContext() {
  if (ctx && ctx.state !== 'running' && typeof ctx.resume === 'function') {
    ctx.resume().catch(() => {}); // non-fatal; backstops will retry
  }
}

function installUnlockHandlers() {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;

  const onGesture = () => {
    buildGraph();
    resumeContext();
  };
  const opts = { once: true, passive: true };
  document.addEventListener('pointerdown', onGesture, opts);
  document.addEventListener('keydown', onGesture, opts);
  document.addEventListener('touchend', onGesture, opts);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeContext();
  });
}

installUnlockHandlers();

// ---- Internal API (for sfx.js / music.js only) -----------------------------

/**
 * Lazily spins up the gain graph and nudges the context toward running. Channels call this at the top
 * of play().
 * @returns {AudioContext | null} The context, or null when audio is unavailable.
 */
export function ensureContext() {
  const c = buildGraph();
  resumeContext();
  return c;
}

/** @returns {AudioContext | null} The live context, or null if it hasn't been built / is unavailable. */
export function getContext() {
  return ctx;
}

/** @returns {GainNode | null} The sfx channel bus, or null before the graph is built. */
export function getSfxBus() {
  return sfxBus;
}

/** @returns {GainNode | null} The music channel bus, or null before the graph is built. */
export function getMusicBus() {
  return musicBus;
}

/**
 * Registers a hook that fires when the gain graph exists (so a channel can write its stored
 * volume/mute onto its bus). Runs immediately if the graph already exists.
 * @param {() => void} hook
 */
export function onReady(hook) {
  readyHooks.push(hook);
  if (sfxBus) {
    try {
      hook();
    } catch {
      /* a channel's ready hook must never break the registrant */
    }
  }
}

/**
 * Registers a hook that fires each time the context reaches the 'running' state — the initial unlock
 * and after every background/foreground cycle. Runs immediately if already running.
 * @param {() => void} hook
 */
export function onRunning(hook) {
  runningHooks.push(hook);
  if (ctx && ctx.state === 'running') {
    try {
      hook();
    } catch {
      /* one channel's running hook must never break another */
    }
  }
}

/** @returns {boolean} Whether the Web Audio API is usable at all (false under happy-dom / old browsers). */
export function isAvailable() {
  return !unavailable;
}

// ---- Public master controls (for settings glue) ----------------------------

/** Sets the master volume (0..1, clamped); the effective output is 0 while master-muted. */
export function setMasterVolume(value) {
  masterVolume = clamp01(value);
  applyMasterGain();
}

/** @returns {number} The master volume slider position (0..1), independent of mute. */
export function getMasterVolume() {
  return masterVolume;
}

/** Sets master mute. Mute is independent of volume so unmuting restores the prior slider position. */
export function setMasterMuted(value) {
  masterMuted = !!value;
  applyMasterGain();
}

/** @returns {boolean} Whether master is muted. */
export function isMasterMuted() {
  return masterMuted;
}

function clamp01(v) {
  v = Number(v);
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
