# Audio

*How to play sounds and music, and how to add new ones. The architecture and its rationale live in [audio-design.md](../design/audio-design.md) and [ADR-025](../design/architecture-decision-records/adr.md#adr-025-audio-architecture-extends-adr-001); this is the practical guide.*

## How it works

Two singletons over a private core, all in `src/audio/`:

- **[`sfx`](../../src/audio/sfx.js)** — short, polyphonic, low-latency clips. Fire-and-forget.
- **[`music`](../../src/audio/music.js)** — one long, looping, streamed track at a time, with crossfades.
- **[`audio-core`](../../src/audio/audio-core.js)** — private plumbing (context, gain graph, the unlock handshake, master volume/mute). **Gameplay never imports this**; only the settings glue touches its master controls.

**Every call is a safe no-op** when audio is unavailable (no `AudioContext`, e.g. the happy-dom test runner), the clip isn't loaded, or the context is still suspended. So **call sites never guard** — no `if (audioEnabled)`.

## Play a sound effect

```js
import { sfx } from '../../audio/sfx.js';

sfx.play('menu-select');                       // fire and forget
sfx.play('hit', { volume: 0.5, rate: 1.1 });   // volume is relative to the channel; rate = pitch
const torch = sfx.loop('torch-crackle');       // ambient loop
torch.stop();                                  // every play()/loop() returns a { stop() } handle
```

The live example is menu button presses: [`menu-shell.js`](../../src/ui/menus/menu-shell.js) calls `sfx.play('menu-select')` when a row, sub-page, corner, or settings segment is activated — so both the main menu and the in-game menu get it from one place.

## Play music

```js
import { music } from '../../audio/music.js';

music.play('menu-theme', { fade: 800 });  // replaces the current track with a crossfade (ms)
music.stop({ fade: 400 });                // fade out and tear down
```

`play` is "stop whatever's playing and transition" — re-requesting the current track is a no-op (no restart). The live example is the title theme: the main-menu scene ([`game-menu.js`](../../src/ui/scenes/game-menu.js)) calls `music.play('menu-theme')` in its `enter()` and `music.stop()` in its `exit()` (the app-state machine fires those on scene push/teardown).

**Browser autoplay:** the context starts suspended until a user gesture. A track requested before then (startup/menu music) is stashed and starts the moment audio unlocks — in this game, the splash screen's OK button is that gesture. So menu music may begin on the first interaction, not the instant the menu paints. This is handled for you; just don't expect sound before any tap.

## Add a new sound or track

1. **Drop the file in** `assets/sfx/` or `assets/music/`. **MP3** is the baseline format — it plays everywhere (see [audio-design.md](../design/audio-design.md#formats)).
2. **Register it in the manifest** in [`audio-settings.js`](../../src/audio/audio-settings.js), keyed by the id you'll `play()`. Build the URL with `import.meta.url` so it resolves when served from a subdirectory (GitHub Pages), per [AGENTS.md](../../AGENTS.md):
   ```js
   const SFX_MANIFEST = {
     'menu-select': new URL('../../assets/sfx/menu-selection.mp3', import.meta.url).href,
     hit: new URL('../../assets/sfx/hit.mp3', import.meta.url).href, // ← new
   };
   ```
   SFX are fetched and decoded up front by `initAudio()`; music tracks only register a URL and stream on first `play()`.
3. **Add it to the service worker** `DYNAMIC_ASSETS` in [`service-worker.js`](../../service-worker.js) (lazily-loaded assets are missed by first-load caching), and **bump `CACHE_VERSION`** so the new build is picked up.
4. `sfx.play('hit')` / `music.play('your-track')` wherever it belongs.

## Volume settings

Three channel volumes (`masterVolume`, `sfxVolume`, `musicVolume`) live in [`gameSettings`](../../src/engine/config/settings.js) — device-level, **never in the save** (audio is outside the determinism contract). The flow:

- The **settings glue** ([`audio-settings.js`](../../src/audio/audio-settings.js)) reads them at boot (`initAudio`, called from [`main.js`](../../src/main.js)) and pushes them into the audio setters; `setAudioVolume(key, value)` re-pushes on change.
- The **Settings UI** rows are discrete segments (Off/Low/Med/Full) in [`game-menu-items.js`](../../src/ui/menus/game-menu-items.js) — the settings toolkit has no slider yet.

The audio modules also support independent per-channel **mute** (`sfx.setMuted` etc.), kept separate from volume so unmute restores the slider position — but mute isn't surfaced in the UI yet; an "Off" volume covers silencing for now.

## Testing

Real audio output is browser-only and verified by ear. What *is* unit-tested (`src/audio/*.test.js`) is the **no-op degradation contract** under happy-dom (which has no `AudioContext`): nothing throws, `play`/`loop` always return a `{stop()}` handle, and volume/mute state round-trips. Don't reach for audio assertions beyond that — follow the canvas/feel guidance in [AGENTS.md](../../AGENTS.md) and listen.

## Don't

- Guard call sites with `if (audioEnabled)` — the facade no-ops; that's the point.
- Import `audio-core` from gameplay — import `sfx` / `music`.
- Let the audio modules read `localStorage` or config — the engine pushes values down through the setters.
- Store audio settings in the save file — they're device-level.
- Decode music into an `AudioBuffer` — it streams through an `<audio>` element.
