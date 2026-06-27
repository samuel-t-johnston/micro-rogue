/**
 * @file The one place that wires audio to the rest of the engine. It owns the asset manifests, loads
 * them at boot, and pushes the persisted device-level volumes from `gameSettings` into the audio
 * setters — at startup (`initAudio`) and again on every settings change (`applyAudioSettings`, called
 * by the audio settings rows). The dependency arrow points one way: this module knows about both
 * config and audio; the audio modules know about neither. See docs/design/audio-design.md.
 */
import { gameSettings } from '../engine/config/settings.js';
import { setMasterVolume } from './audio-core.js';
import { sfx } from './sfx.js';
import { music } from './music.js';

// Asset URLs are resolved against this module's location so they work when the game is served from a
// subdirectory (GitHub Pages), per AGENTS.md. These files are also listed in the service worker's
// DYNAMIC_ASSETS so they're cached for offline play.
const SFX_MANIFEST = {
  'menu-select': new URL(
    '../../assets/sfx/freesound_community-menu-selection-102220.mp3',
    import.meta.url,
  ).href,
};

const MUSIC_MANIFEST = {
  'menu-theme': new URL(
    '../../assets/music/samuelfjohanns-crawling-danger-303228.mp3',
    import.meta.url,
  ).href,
};

/** Pushes the persisted channel volumes into the audio setters. Safe to call repeatedly. */
export function applyAudioSettings() {
  setMasterVolume(gameSettings.get('masterVolume'));
  sfx.setVolume(gameSettings.get('sfxVolume'));
  music.setVolume(gameSettings.get('musicVolume'));
}

/** Persists a volume setting and re-pushes it to the audio layer. Used by the settings rows. */
export function setAudioVolume(key, value) {
  gameSettings.set(key, value);
  applyAudioSettings();
}

/** Boot hook: decode SFX, register music tracks, and apply persisted volumes. Call once at startup. */
export function initAudio() {
  sfx.load(SFX_MANIFEST);
  music.load(MUSIC_MANIFEST);
  applyAudioSettings();
}
