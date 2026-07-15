# Audio System Design
*How ROGµE plays sound: two singletons (`sfx`, `music`) over a private `audio-core`, every call degrading to a silent no-op. Implemented in `src/audio/`; the decision is recorded in [ADR-025](architecture-decision-records/adr.md#adr-025-audio-architecture-extends-adr-001). Usage guide: [docs/howto/audio.md](../howto/audio.md) (added when the first call sites land).*

## Core Principles

- **Audio is an enhancement layer.** The game works fully without sound. Every
  call must degrade to a silent no-op — disabled in settings, no `AudioContext`
  (old browser, test runner), asset not loaded, context still suspended. Nothing
  in gameplay code guards.
- **Two singletons, imported directly.** `sfx` and `music` are imported wherever
  a sound needs to play. Audio is a true cross-cutting concern with no
  per-caller state and nothing in the seed/save contract to keep consistent, so
  threading a handle through combat, movement, and UI would be friction for zero
  benefit. One audio output → one singleton each.
- **Split by verb shape, share the plumbing.** SFX and music expose different
  operations and use different playback mechanisms. They share only a thin
  private core (the context, the unlock handshake, the master bus).
- **Settings are contract; persistence is not.** The public surface exposes
  volume/mute setters and getters. *Where* those values are persisted is the
  engine's concern, kept entirely outside the audio modules.

---

## The Three Modules

```
audio-core.js   private plumbing — never imported by gameplay
   |  context, gain graph, unlock, master volume/mute
   |
   +-- sfx.js     singleton — imported in many places
   +-- music.js   singleton — imported in ~3 places
```

These live in `src/audio/`. This design doc lives in `docs/design/` alongside
the others.

### Why two public modules over one shared core

The shared-machinery worry dissolves once you notice SFX and music want
different playback mechanisms entirely:

| | SFX | Music |
|---|---|---|
| Length | Short | Long |
| Polyphony | Many overlapping | One at a time |
| Latency | Must be low | Irrelevant |
| Mechanism | Decode to `AudioBuffer`, fire a source node per shot | Stream through an `<audio>` element |
| Call sites | Many | Few (startup, level change, menu) |

Those two paths share almost no playback code. What they *do* share is low-level
and lives in `audio-core`: the first-gesture unlock and the master controls. So
the decomposition is **two public singletons over a small private core** — split
because the operations differ (`sfx.play` is fire-and-forget and polyphonic;
`music.play` means "stop whatever's playing and transition"), not because they
share little.

---

## The Gain Graph

```
sfxBus   --\
            >-- masterGain -- destination
musicBus --/
```

Each channel has its own gain node; the master has one feeding the destination.
The master × channel multiplication happens in the signal path, so every setter
writes exactly one node's gain — no manual arithmetic, no recomputation when the
master moves. The structure the mixer needs *is* the structure the settings
need; the gain graph and the three-knob settings model fall out of each other.

`audio-core` owns and builds this graph. `sfx` and `music` hold their own
volume/mute *state* and write their bus node's gain; the core owns the master
node and its state.

---

## Settings Contract

Three independent volumes and three independent mutes:

| Control | Lives in | Public method |
|---|---|---|
| Master volume | `audio-core` | `setMasterVolume(v)` / `getMasterVolume()` |
| Master mute | `audio-core` | `setMasterMuted(b)` / `isMasterMuted()` |
| SFX volume | `sfx` | `sfx.setVolume(v)` / `sfx.getVolume()` |
| SFX mute | `sfx` | `sfx.setMuted(b)` / `sfx.isMuted()` |
| Music volume | `music` | `music.setVolume(v)` / `music.getVolume()` |
| Music mute | `music` | `music.setMuted(b)` / `music.isMuted()` |

Effective gain per channel = `(masterMuted || channelMuted) ? 0 : masterVolume *
channelVolume`, realised by the graph rather than computed by hand.

> **Status: mute is API-present, UI-deferred.** The six mute methods above are
> implemented and tested, but nothing drives them yet — `applyAudioSettings`
> (`audio-settings.js`) pushes only the three *volumes* from the settings store,
> and there is no mute settings key or UI toggle. Mute is a ready extension point:
> a fork can call the setters directly, or wire `*Muted` settings keys through
> `applyAudioSettings` to surface it. Tracked as "Improved audio config UI" in the
> roadmap's deferred section. (An "Off" volume covers silencing in the shipped UI
> for now.)

### Mute is independent of volume

Even though both collapse to a gain value, mute is modelled as its own boolean,
not as "volume 0". If mute *were* volume 0, a player who mutes, quits, and
returns would lose their slider position — restoring it means stashing the
pre-mute value somewhere, which is just separate mute state in disguise. Every
real audio UI keeps the slider where you left it while muted and returns to it on
unmute. Effective gain is `muted ? 0 : volume`; the collapse to one number is an
implementation detail behind the setters.

### Persistence is owned by the engine, pushed in

The audio modules are dumb holders of their own volume/mute state. They never
read `localStorage` and never import the config system. The engine reads
persisted values at startup and calls the setters; when the settings UI changes a
value, it writes `localStorage` *and* calls the setter. This keeps the
dependency arrow pointing one way — the engine knows about both config and audio;
audio knows about neither.

The rejected alternative was injecting a config callback (`initAudio({
getSetting })`). That couples every drop-in replacement to the shape of our
config and inverts control awkwardly (the audio layer reaching out to pull state
on each play). Pushing state down through plain setters is cleaner and is exactly
what a library backend (howler) already supports 1:1.

Audio settings sit at the **device level**, like the future UI-layout
preferences — never in the seeded save file. Audio is entirely outside the
determinism contract.

---

## No-Op Degradation

The property that makes direct-import-everywhere safe. Because call sites never
guard, the facade silently swallows every failure mode:

- **Unavailable** — no `AudioContext` constructor (happy-dom, ancient browsers).
  The core marks itself unavailable; buses are null; all play paths return early.
- **Not loaded** — unknown clip/track id logs a dev warning and no-ops.
- **Suspended** — context not yet unlocked. SFX attempts a resume and may miss
  the very first sound; music stashes the request and replays on unlock.

Every `sfx.play` / `sfx.loop` returns a handle-shaped object even on the no-op
path, so `handle.stop()` is always safe to call.

---

## Unlock Handling

Browsers start the context suspended until a user gesture; iOS also suspends on
backgrounding. The core handles all of it in one place:

- One-time `pointerdown` / `keydown` / `touchend` listeners resume the context
  on first interaction.
- Every `play()` calls `ensureContext()`, which also nudges a resume — so a
  sound triggered *by* a tap (a menu blip) unlocks audio as a side effect.
- A `visibilitychange` handler resumes on return to foreground.
- Music registers an `onRunning` hook: a track requested while suspended (startup
  music) is stashed and started the moment the context reaches `running`.

This mirrors the save system's `visibilitychange` usage — same lifecycle event,
different concern.

---

## SFX: Playback Model

Decoded once into `AudioBuffer`s by `sfx.load(manifest)` up front. Each
`sfx.play(id)` creates a fresh `AudioBufferSourceNode`, so a sound overlaps
itself with no latency and no pooling. Options:

- `volume` — per-shot, **relative** to the channel. Rides on its own gain node,
  so `0.5` means "half this clip" regardless of the sfx slider.
- `rate` — playback rate (cheap pitch variation; useful to de-monotonise
  repeated hits later).

`sfx.loop(id)` is the same path with `loop = true`; the returned handle's
`stop()` is the intended way to end ambient loops.

## Music: Playback Model

Streamed through an `<audio>` element routed via `MediaElementAudioSourceNode`
into the music bus — never decoded into memory. `music.play(id)` replaces the
current track:

- Each track gets its own gain node, so the outgoing track fades down while the
  incoming fades up — a real crossfade, independent of channel volume.
- `fade` (ms) controls the crossfade; defaults to 500ms.
- `loop` defaults to `true`.
- Re-requesting the current track is a no-op (no restart).

`music.stop({ fade })` fades out and tears down. A new element is created per
track (a `MediaElementSource` can only be created once per element) and cleaned
up after the fade.

---

## Use Cases

**SFX call sites (many):** combat resolution (hit, miss, death), movement
(footstep, bump), item pickup/use, UI taps, trap triggers. All fire-and-forget:
`sfx.play('hit')`.

**Music call sites (few):** app startup / title (`music.play('title-theme')`),
level transition (`music.play(levelThemeFor(depth), { fade: 600 })`), and
entering/leaving certain menus. Because these are all "moment" triggers, music
could eventually become a thin reactor to game state (current level theme → play
matching track) the way UI components react to pushed state — noted as a possible
later move, not built now; three imperative call sites don't justify it.

**Settings glue (one place):** imports `audio-core` (master), `sfx`, and `music`.
Reads persisted values at startup, pushes them in via the setters, and re-pushes
on every settings change. The only code that touches all of audio.

---

## Fork-Friendliness and the Swap Point

The rest of the engine swaps implementations behind interfaces (PRNG, renderer,
turn module). Audio follows the same principle: **the interface is the contract;
the backend is replaceable.** A fork wanting howler (or anything else) instead of
the bespoke Web Audio backend reimplements `sfx.js` / `music.js` against the same
method surface — the call sites scattered across gameplay don't change.

This is why the singletons are backed *directly* by the Web Audio code today
rather than through runtime injection: the swap point is the file, not a DI
container. A startup-set backend (`initAudio({ sfx: impl })`) is a small future
delta if a fork wants to swap without forking the file — added when wanted, not
pre-built.

`audio-core` exports two tiers: the **master controls** (public, for settings
glue) and the **routing internals** — `ensureContext`, `getSfxBus`,
`getMusicBus`, `onReady`, `onRunning` — consumed only by `sfx.js` / `music.js`.
Gameplay imports `sfx` and `music`; only settings reaches into the core's master
controls.

---

## Formats

**MP3 is the universal baseline** — it plays everywhere, so it's the safe
single-format choice. WebM/Opus is *not* the broadest (Safari's Opus support has
been unreliable for years).

- **SFX** — MP3. The Opus size win on a few-KB clip is negligible; not worth two
  encodes per sound.
- **Music** — the only place a second format earns its keep (Opus is meaningfully
  smaller per track, which matters for the offline PWA cache) and the only place
  MP3's gapless-loop seam bites. If a second format is added at all, add it here:
  Opus in WebM/OGG with an MP3 fallback.

`AAC/M4A` in MP4 is the one universal format that beats MP3 on size and works in
Safari — a reasonable single-format choice for both if dual-encoding is
unwanted.

---

## Forward-Compat Hooks (Not Built Now)

- **Handles** — `play`/`loop` already return `{ stop() }`, so ambient/stoppable
  sounds need no signature change later.
- **Positional / ambient audio** — a per-shot gain node already exists; panning
  (a `StereoPannerNode` per shot, or distance attenuation keyed to entity
  position) slots in without touching the contract. Likely M7.
- **Music as state reactor** — see Use Cases. A later option, not a current need.
- **Library backend via injection** — `initAudio({ sfx, music })` if forks want
  to swap without forking the file.

This decision (Web Audio bespoke backend, two singletons over a private core,
settings pushed in not injected — rejecting a unified `audio.play`,
mute-as-volume-0, and config-callback injection) is recorded in
[ADR-025](architecture-decision-records/adr.md#adr-025-audio-architecture-extends-adr-001).

---

## What to Avoid

- Threading an audio handle through gameplay — import the singletons directly.
- Guarding call sites with `if (audioEnabled)` — the facade no-ops; that's the
  point.
- Modelling mute as volume 0 — it loses the slider position across mute/unmute.
- Letting the audio modules read `localStorage` or import the config system —
  the engine pushes values down through the setters.
- Storing audio settings in the save file — they're device-level, outside the
  determinism contract.
- Decoding music into an `AudioBuffer` — stream long tracks through an `<audio>`
  element.
- A unified `audio.play()` for both SFX and music — the operations differ; split
  by verb shape.
