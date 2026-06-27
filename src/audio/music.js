/**
 * @file Singleton music API. Imported in only a few places — startup, level change, the menu —
 * because music is a "current track" concept, not a fire-and-forget one:
 *
 *     import { music } from './music.js';
 *     music.play('dungeon-theme', { fade: 600 });
 *     music.stop({ fade: 400 });
 *
 * Long, looping, monophonic. Streamed through an <audio> element rather than decoded into memory — a
 * multi-megabyte track has no business being a fully decoded AudioBuffer. play() replaces whatever is
 * currently playing, with an optional crossfade. Degrades to a silent no-op when audio is unavailable.
 */

import { ensureContext, getContext, getMusicBus, onReady, onRunning } from './audio-core.js';

const sources = new Map(); // id -> url

let volume = 1;
let muted = false;

const DEFAULT_FADE = 500; // ms

// The currently-playing track: its element, its MediaElementSource, and its own
// gain node, so it can be crossfaded independently of the channel volume.
let current = null; // { id, el, srcNode, gain } | null

// If play() is called before the context can run (e.g. startup music, before
// the player has touched anything), the request is stashed and fired the moment
// audio unlocks. Only the latest request is kept.
let pending = null; // { id, opts } | null

function applyBus() {
  const bus = getMusicBus();
  if (bus) bus.gain.value = muted ? 0 : volume;
}
onReady(applyBus);
onRunning(() => {
  if (pending) {
    const { id, opts } = pending;
    pending = null;
    play(id, opts);
  }
});

function load(manifest) {
  // manifest: { id: url, ... }. Unlike sfx.load this only registers sources;
  // tracks stream on demand, so nothing is fetched until first play.
  for (const [id, url] of Object.entries(manifest)) sources.set(id, url);
}

function play(id, opts) {
  opts = opts || {};
  const url = sources.get(id);
  if (url === undefined) {
    console.warn(`[music] unknown track "${id}"`);
    return;
  }
  const ctx = ensureContext();
  if (!ctx) return; // unavailable
  const bus = getMusicBus();
  if (!bus) return;

  // Can't actually start until the context is running. Stash and let the
  // onRunning hook replay once audio unlocks.
  if (ctx.state !== 'running') {
    pending = { id, opts };
    return;
  }

  // Already the current track — don't restart it.
  if (current && current.id === id) return;

  const fade = typeof opts.fade === 'number' ? opts.fade : DEFAULT_FADE;
  const now = ctx.currentTime;

  // Fade out and tear down the outgoing track (crossfade).
  if (current) fadeOutAndStop(current, fade);

  // Build the incoming track.
  const el = new Audio(url);
  el.loop = opts.loop !== undefined ? opts.loop : true;
  el.preload = 'auto';

  let srcNode;
  try {
    srcNode = ctx.createMediaElementSource(el);
  } catch (err) {
    console.warn(`[music] could not route "${id}":`, err);
    return;
  }
  const gain = ctx.createGain();
  gain.gain.value = 0;
  srcNode.connect(gain);
  gain.connect(bus);

  current = { id, el, srcNode, gain };

  // Fade the new track in.
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + fade / 1000);

  const started = el.play();
  if (started && typeof started.catch === 'function') {
    started.catch(() => {
      // Autoplay blocked despite a running context — re-stash and let the next
      // gesture's onRunning pass start it.
      pending = { id, opts };
    });
  }
}

function stop(opts) {
  opts = opts || {};
  const fade = typeof opts.fade === 'number' ? opts.fade : DEFAULT_FADE;
  pending = null;
  if (current) {
    fadeOutAndStop(current, fade);
    current = null;
  }
}

function fadeOutAndStop(track, fade) {
  const ctx = getContext();
  const { el, gain, srcNode } = track;
  if (ctx && gain) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade / 1000);
  }
  // Tear down once the fade has finished.
  setTimeout(() => {
    try {
      el.pause();
    } catch {
      /* element already detached */
    }
    try {
      srcNode.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
    el.src = '';
  }, fade + 50);
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

function clamp01(v) {
  v = Number(v);
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export const music = {
  load,
  play,
  stop,
  setVolume,
  getVolume,
  setMuted,
  isMuted,
};
