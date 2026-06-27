/**
 * @file Player UI preferences — distinct from gameConfig (build/debug flags) and from the save
 * slot (per-run game state). Settings outlive any single run, so they get their own
 * localStorage key and are loaded once at boot. Like gameLog/rng/gameConfig this is an
 * ambient singleton: the widgets that honor a setting (e.g. handedness) read it directly
 * rather than having it threaded through every constructor.
 *
 * Parsing is split from I/O (see save-system.js) so the merge logic is unit-testable
 * without touching localStorage.
 */

const STORAGE_KEY = 'rogue:settings';

/** Default player UI preferences; also defines the valid shape of the settings store. */
export const DEFAULT_SETTINGS = Object.freeze({
  // 'right' → primary action button bottom-right (default). 'left' → mirror the
  // corner-anchored UI horizontally for left-handed reach. See docs/howto/handedness.md.
  handedness: 'right',

  // When true, the New Game instructions screen is skipped and a new run loads straight into the
  // game. Toggled from that screen's "Do not display again" checkbox and the Settings menu.
  skipNewGameInstructions: false,

  // Map rendering style: 'sprite' draws sheet art (default); 'glyph' draws ASCII characters
  // (the classic roguelike look). Read live by the renderer, so toggling takes effect next frame.
  renderMode: 'sprite',

  // Audio channel volumes (0..1), device-level like the rest of this store and outside the save.
  // The audio modules own playback; the settings glue (src/audio/audio-settings.js) pushes these
  // values into their setters at boot and on change. Per-channel mute exists in the modules but isn't
  // surfaced here yet — an "Off" volume covers silencing for now. See docs/howto/audio.md.
  masterVolume: 1,
  sfxVolume: 1,
  musicVolume: 0.66,
});

// Settings whose value is a volume in [0,1]; validated/clamped together below.
const VOLUME_KEYS = ['masterVolume', 'sfxVolume', 'musicVolume'];

/**
 * Merges a parsed object over the defaults, dropping unknown keys and invalid values. Any
 * malformed field falls back to its default, so a corrupt store can never wedge the UI.
 */
export function normalizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (raw && (raw.handedness === 'left' || raw.handedness === 'right')) {
    out.handedness = raw.handedness;
  }
  if (raw && typeof raw.skipNewGameInstructions === 'boolean') {
    out.skipNewGameInstructions = raw.skipNewGameInstructions;
  }
  if (raw && (raw.renderMode === 'sprite' || raw.renderMode === 'glyph')) {
    out.renderMode = raw.renderMode;
  }
  for (const key of VOLUME_KEYS) {
    const v = raw?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v < 0 ? 0 : v > 1 ? 1 : v; // clamp into [0,1]
    }
  }
  return out;
}

let current = { ...DEFAULT_SETTINGS };

/** Ambient singleton for player UI preferences: in-memory state plus localStorage persistence. */
export const gameSettings = {
  get(key) {
    return current[key];
  },
  all() {
    return { ...current };
  },

  // Set one key and persist. An invalid value (or unknown key) is a no-op — the key keeps its
  // prior valid value — rather than silently snapping back to the default or corrupting the store.
  set(key, value) {
    const candidate = normalizeSettings({ ...current, [key]: value });
    if (candidate[key] !== value) return; // value was rejected by normalize
    current = candidate;
    write(current);
  },

  // Read the persisted store at boot. Missing/corrupt store → defaults.
  load() {
    current = normalizeSettings(read());
    return current;
  },

  // Test hook: restore defaults without touching storage.
  reset() {
    current = { ...DEFAULT_SETTINGS };
  },
};

// --- localStorage I/O ---

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, quota) — settings stay in-memory for the session.
  }
}
