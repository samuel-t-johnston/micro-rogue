# Language

*How spoken sounds are gated by language — who can speak, who understands, and what the listener hears when they don't.*

Language only matters for **vocalized sounds** (shouts, barks). It rides on the [sound & hearing](sound.md) system: a sound can carry a `language`, and a hearer either decodes it or just hears that *something* was said. Non-verbal sounds (combat clatter, vermin scrabble) have no language and are always understood as what they are.

## How it works

Two components, on opposite ends of a shout:

- **`voice(language)`** ([`components.js`](../../src/world/entities/components.js)) — the *speaker* side. Its presence is what lets an entity shout at all; the [`shout` action](../../src/actions/action-types/action-shout.js) stamps every sound it emits with `voice.language`. A voiceless (or silenced) actor produces no sound, though the action still consumes its turn.
- **`knownLanguages([...])`** — the *listener* side: the set of languages an entity comprehends. Stored as a plain string array so it serializes cleanly.

The [`hearing` sense](../../src/ai/senses/hearing.js) joins the two when it turns a heard sound into a percept:

```js
understood: snd.language == null || known.has(snd.language)
```

So a sound is `understood` when it's non-verbal (`language == null`) **or** the hearer's `knownLanguages` contains its language. The `understood` flag then flows two ways:

- **Goals** can require it before acting — [`obey-shouts`](../../src/ai/goals/obey-shouts.js) only follows an order it actually understood (an orc obeys an orcish enemy report; a creature that doesn't speak orcish hears only noise).
- **The player log** renders understood vs. not in [`sound-text.js`](../../src/engine/log/text/sound-text.js): an understood enemy report becomes "You hear a shout: an enemy to the north," while an un-understood one becomes "You hear guttural orcish shouting to the north" — the *direction* survives, the *meaning* doesn't.

## What ships

- **`orcish`** — the only language so far. Orc squad members get `knownLanguages(['orcish'])`; the Orc Commander also gets `voice('orcish')` so it can bark enemy reports its squad obeys (see [`creatures.js`](../../src/world/entities/creatures.js) and [sound.md](sound.md)'s bark example).
- **The player** is created with `knownLanguages([])` — knowing no languages, so every orcish shout reads as untranslated noise. Teaching the player a language later (adding to the set) is exactly what makes the log start decoding it; no other code changes.
- **Un-understood flavor** lives in `LANGUAGE_FLAVOR` in `sound-text.js` (`orcish → 'guttural orcish'`), falling back to the bare language name for anything unlisted.

## Add a language

1. Pick a string id (e.g. `'draconic'`) — there's no registry; the id is just a tag matched between `voice` and `knownLanguages`.
2. Give speakers `voice('draconic')` and comprehenders `knownLanguages([... , 'draconic'])`.
3. Optionally add a `LANGUAGE_FLAVOR['draconic']` entry in `sound-text.js` so the un-understood case reads better than the bare id ("hissing draconic" vs "draconic").

That's the whole surface — the hearing sense and the renderer already do the rest.

## See also

- [Sound & hearing](sound.md) — the system language rides on.
- [AI senses](ai-senses.md) — the sound percept shape (`understood`, `message`, `language`).
