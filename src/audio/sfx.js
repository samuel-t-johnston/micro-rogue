/**
 * @file Singleton sound-effects API. Import it anywhere a sound needs to fire — no threading, no
 * handle to pass around:
 *
 *     import { sfx } from './sfx.js';
 *     sfx.play('hit');
 *     sfx.play('hit', { volume: 0.5, rate: 1.1 });
 *     const torch = sfx.loop('torch-crackle');
 *     torch.stop();
 *
 * Short, polyphonic, low-latency sounds. Each clip is decoded once into an AudioBuffer; every play
 * fires a fresh AudioBufferSourceNode, so the same sound overlaps itself with zero latency.
 * Fire-and-forget: callers never guard, and every method is a safe no-op when audio is unavailable,
 * the clip hasn't loaded, or the context can't start.
 */

import { ensureContext, getSfxBus, onReady } from './audio-core.js';
import { clamp01 } from './clamp.js';

const buffers = new Map(); // id -> AudioBuffer

let volume = 1; // channel slider position, 0..1
let muted = false; // independent of volume

// Returned from every play()/loop() so call sites can stop a sound without the
// API caring whether one is actually playing. Looping ambient sounds are the
// real use; one-shots ignore it.
const NOOP_HANDLE = Object.freeze({ stop() {} });

function applyBus() {
  const bus = getSfxBus();
  if (bus) bus.gain.value = muted ? 0 : volume;
}
onReady(applyBus);

async function load(manifest) {
  // manifest: { id: url, ... }. Fetches and decodes every clip up front.
  // A clip that fails is logged and skipped — never rejects the batch, because
  // missing audio must not break the game.
  const ctx = ensureContext();
  if (!ctx) return; // unavailable — nothing to decode into
  await Promise.all(
    Object.entries(manifest).map(async ([id, url]) => {
      try {
        const res = await fetch(url);
        const data = await res.arrayBuffer();
        buffers.set(id, await ctx.decodeAudioData(data));
      } catch (err) {
        console.warn(`[sfx] failed to load "${id}" from ${url}:`, err);
      }
    }),
  );
}

function play(id, opts) {
  return fire(id, opts || {}, false);
}

function loop(id, opts) {
  return fire(id, opts || {}, true);
}

function fire(id, opts, looping) {
  const ctx = ensureContext();
  if (!ctx) return NOOP_HANDLE;
  const bus = getSfxBus();
  if (!bus) return NOOP_HANDLE;
  const buffer = buffers.get(id);
  if (!buffer) {
    console.warn(`[sfx] unknown clip "${id}"`);
    return NOOP_HANDLE;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = looping;
  if (typeof opts.rate === 'number') source.playbackRate.value = opts.rate;

  // Per-shot volume rides on top of the channel volume via its own gain node,
  // so it is *relative* — 0.5 means "half this clip", independent of where the
  // sfx slider sits.
  if (typeof opts.volume === 'number') {
    const shotGain = ctx.createGain();
    shotGain.gain.value = clamp01(opts.volume);
    source.connect(shotGain);
    shotGain.connect(bus);
  } else {
    source.connect(bus);
  }

  source.onended = () => {
    try {
      source.disconnect();
    } catch {
      /* already disconnected/torn down */
    }
  };

  try {
    source.start(0);
  } catch {
    return NOOP_HANDLE;
  }

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        /* not started, or already stopped */
      }
    },
  };
}

function setVolume(value) {
  volume = clamp01(value);
  applyBus();
}
function getVolume() {
  return volume;
}
function setMuted(value) {
  muted = !!value;
  applyBus();
}
function isMuted() {
  return muted;
}

export const sfx = {
  load,
  play,
  loop,
  setVolume,
  getVolume,
  setMuted,
  isMuted,
};
