# Text System Design

*Standardizing user-facing text: one discoverable home for strings, and one
place that turns entities into grammatical noun phrases. Maintainability first;
i18n-ready, not i18n-now.*

**Status: proposed — not yet implemented.** Supersedes the philosophy of
[ADR-013](architecture-decision-records/adr.md#adr-013-display-string-generation)
(don't edit 013; a new ADR records the supersession — see "ADR to write").

Related: [`dev-tools-and-logging.md`](dev-tools-and-logging.md) (the event log
`display` field), [`game-architecture.md`](game-architecture.md) (entity model),
[`ux-design.md`](ux-design.md) (menus, HUD, message log),
[`audio-design.md`](audio-design.md) (the singleton + injected-config pattern we
mirror), [`howto/logging.md`](../howto/logging.md).

---

## Goal / Non-Goals

**Goal.** One stable, discoverable home for user-facing text, and **one** place
that turns game entities into grammatical noun phrases. Be able to find and
change any string regardless of where it's used. Collapse the duplicated
"you vs. the goblin" / name-formatting / article / list-join logic currently
spread across call sites and three near-identical `text/` modules.

**Non-goal.** Shipping localization. No per-locale catalogs, no language
switcher, no translation workflow. We architect so i18n is a *bounded later
change* (swap the catalog + resolver, leave call sites untouched) — we do not
build it.

**Explicitly out (this pass):** build steps, runtime deps, ICU/Fluent
select-plural syntax in templates, gender/case agreement engines, any
non-English grammar, and any change to the serialized save format.

**Permanent constraint.** The project is build-free for good. Every part of this
system — and any future i18n extension — must resolve at runtime. Build-assuming
i18n toolchains (gettext `.po` compilation, Fluent `.ftl` precompilation, message
extraction / codegen) are permanently excluded, not deferred. The only viable
later options are runtime parsers (`intl-messageformat`, `@fluent/bundle`) or
staying hand-rolled.

---

## Where the codebase already is

The consolidation is already partly done, which shapes the work and the build
order:

1. **A grammar adapter already exists.** `src/engine/log/text/log-text.js`
   centralizes the entity → noun-phrase logic: `isPlayer`, `subject` (`You` /
   `The goblin`), `object` (`you` / `the goblin`), `conjugate` (verb agreement
   by person), `itemName`. Every `action-*` handler already routes through it,
   and [`howto/logging.md`](../howto/logging.md) already tells authors to use it.
   `grammar.js` is built by **absorbing and extending `log-text.js`**, not from
   scratch.

2. **Player identity is already solved.** `isPlayer(entity)` is
   `entity.components.has('playerControlled')`. The adapter's "is this the
   player" question needs no new mechanism.

3. **Two more text builders mirror it:** `sound-text.js` (`describeSound`) and
   `smell-text.js` (`describeSmell`). They each carry a **verbatim duplicate** of
   a `DIRECTION_WORDS` map, plus their own flavor tables.

4. **Several sites bypass the helpers** with ad-hoc formatting the adapter should
   own: `describe-tile.js` (its own `withArticle` a/an logic and a `joinList`
   "a, b, and c"), `action-throw.js` (`joinNames`, `capitalize`, item-subject
   lines), `action-interact.js` (`The ${name}`, `name.toLowerCase()`).

5. **Static UI text is the scattered surface.** Literals live across ~12 UI
   files — `game-menu.js` (New Game / Continue / Settings / Credits / "Overwrite
   existing save?"), `splash.js`, `results-scene.js`, `instructions-scene.js`,
   the inventory/equipment screens (Use / Equip / Throw / Drop / Cancel /
   Unequip / section labels), `message-log.js` ("No messages yet."), dialogs
   (Cancel). This is the largest raw maintainability win and the lowest-risk
   place to prove the loader.

The log/grammar layer is already mostly consolidated; the catalog's biggest
immediate payoff is the scattered static UI. The build order follows that.

---

## The Core Decision

**The commitment is the interface, not the implementation.** What the call sites
depend on is the shape `t(key, params)` plus a grammar adapter that renders
entities as noun phrases. That contract is the expensive, hard-to-move surface
and is designed first. The resolver behind it starts as a small hand-rolled
module and can later be swapped (for `intl-messageformat`, Fluent, etc.) without
touching a call site.

This is the same swap-point pattern the project already uses for theme tokens,
the atlas manifest, and the PRNG: data behind a stable interface. The text
catalog is text data behind a stable resolver.

**This preserves ADR-013's real insight.** Resolution still happens at the site
where context is free — actor, pronoun context, and outcome are all in hand.
What changes is only that the literal text lives in a catalog the site *reads
from* rather than being hand-written at the site.

---

## Architecture

### 1. The resolver contract

```js
t(key, params) -> string
```

- `key` — dotted, domain-namespaced: `combat.melee.hit`, `ui.menu.newGame`.
- `params` — a flat object. **Entity-valued params are passed as entities, never
  pre-stringified names** (the one forward-looking rule, §5). Scalars (numbers,
  already-resolved strings) pass through as-is.
- Returns a finished display string.

`t` is an **ambient singleton import**, like `gameLog`, `rng`, and `gameConfig`
([`howto/logging.md`](../howto/logging.md)) — *not* a handle threaded through
signatures. It is called from too many leaf sites for injection to be anything
but friction, and it has no per-caller state.

The event log's `display` field doesn't change shape — it's now the output of
`t()` instead of a hand-written string. Nothing downstream of `display` changes.

```js
log(t('combat.melee.hit', { actor: attacker, target: defender, damage: 4 }));
```

### 2. The catalog

Per-domain JSON files, merged into one flat in-memory map at startup. Domains
(reconcile with real surfaces as they migrate): `ui`, `combat`, `items`, `ai`,
`system`.

```json
{
  "combat.melee.hit":      "{actor:Subj} {hit/hits:v(actor)} {target:obj} for {damage} damage.",
  "combat.melee.hit.crit": "{actor:Subj} critically {hit/hits:v(actor)} {target:obj} for {damage} damage!",
  "combat.melee.miss":     "{actor:Subj} {miss/misses:v(actor)} {target:obj}."
}
```

- Keys are namespaced so file load order is irrelevant; a key collision across
  files is a **bug** and must throw at load (dev-visible).
- Catalog is **data, no code in the JSON.**
- The text module **does not read `localStorage`.** Same rule as the audio
  modules: persistence/config is owned by the engine and injected (§7).
- Paths are resolved with `new URL(relative, import.meta.url)` per AGENTS.md, so
  the catalog loads correctly from a subdirectory (GitHub Pages). The JSON files
  must also be added to the service worker's asset list and the cache version
  bumped when they change.

### 3. The grammar adapter — `grammar.js`

One module, English only, the **only** place that turns an entity into a noun
phrase. Built by extending `log-text.js` and pulling the ad-hoc formatters
(§"Where the codebase already is", items 3–4) into it, then deleting the
duplicates.

Template params carry a role annotation `{param:role}`:

| Token            | Renders (player / common / proper)            |
|------------------|-----------------------------------------------|
| `{x:Subj}`       | `You` / `The goblin` / `Gnasher`              |
| `{x:subj}`       | `you` / `the goblin` / `Gnasher`              |
| `{x:obj}`        | `you` / `the goblin` / `Gnasher`              |
| `{x:poss}`       | `your` / `the goblin's` / `Gnasher's`         |
| `{a/b:v(x)}`     | verb agreeing with `x`: `a` if `x` is 2nd person, else `b` |
| `{x}`            | raw interpolation (numbers, prebuilt strings) |

> **On the syntax.** The `{param:role}` interpolation echoes ordinary
> named-argument templating. The `{a/b:v(x)}` **verb token is bespoke to this
> project** — a deliberately minimal, hand-parseable construct, *not* ICU or
> Fluent. It exists so the catalog can later be reauthored into a real runtime
> message-format syntax without changing call sites. It covers only the
> agreement case that actually occurs (2nd-person player vs. 3rd-person everyone
> else).

**Why a verb token.** Verb agreement currently lives at the call site:
`conjugate(actor, 'hit', 'hits')`. A template that bakes one verb form in
("…strikes…") produces "You strikes…". The verb token is the home for what
`conjugate` does — it keeps **one key per message** instead of forking every
actor-verb line into `.you` / `.other` variants (~14 messages would double, and
the person check would scatter back to call sites, which is the duplication we're
removing).

Rules the adapter owns:
- **Second person.** When the entity is the player (`playerControlled`), every
  role renders as you/your and `:v` picks the 2nd-person form.
- **Capitalization.** A capitalized role token capitalizes the first letter of
  the rendered phrase; proper nouns are always capitalized regardless of token
  case. Names are normalized to a lowercase base noun + a `proper` flag (§4), so
  "The goblin" / "the goblin" / "Gnasher" all fall out of the same rule. This
  changes some existing strings (e.g. "the Goblin" → "the goblin") and a few
  literal-string tests — intended scope of phase 2.
- **Articles & lists.** Definite article from the entity's naming data for common
  nouns, none for proper nouns; a/an indefinite for "look at" phrasing; the
  "a, b, and c" list join — all consolidated here, replacing the copies in
  `describe-tile.js` and `action-throw.js`.

Lean on the platform for the rest: `Intl.NumberFormat` for numbers,
`Intl.PluralRules` for count agreement. Do **not** reimplement these.

### 4. Naming metadata: a static side-table

Grammar metadata is identical for every instance of a type — it's **static
reference data, not per-entity state** — so it lives in a static,
**non-serialized** table keyed by a stable type id, *not* on the serialized
`name` component:

```js
// src/text/naming.js — pure data, never touches the save file
export const naming = {
  goblin:             { base: 'goblin',          proper: false, article: 'the', pronoun: 'it' },
  orc:                { base: 'orc',             proper: false, article: 'the', pronoun: 'it' },
  'orc-commander':    { base: 'orc commander',   proper: false, article: 'the', pronoun: 'it' },
  'healing-potion':   { base: 'healing potion',  proper: false, article: 'the', pronoun: 'it' },
  'amulet-of-yendor': { base: 'Amulet of Yendor', proper: true,                  pronoun: 'it' },
};
```

The adapter resolves an entity's key off the instance and falls back safely:

```js
function nameData(entity) {
  const key = entity.components.get('renderable')?.sprite;   // e.g. 'goblin'
  return naming[key] ?? {
    base: (entity.components.get('name') ?? 'creature').toLowerCase(),
    proper: false, article: 'the', pronoun: 'it',
  };
}
```

**The join key** must be a *stable, locale-invariant* type id — **not** the
display string. Keying on the display name (`'Goblin'`) is the i18n anti-pattern:
the display string is exactly what changes per locale, so the join would break
the moment text is localized. The semantically correct id is the **prefab key**
(`entity-prefabs.js`, whose docstring already calls it "the stable id"), but it
isn't stored on entity instances. The one stable, locale-invariant id that *is*
on the instance today is `renderable.sprite`, so the adapter keys on it for this
pass. **i18n-time upgrade:** stamp the prefab id onto instances (a small additive
`type` component, no migration — old saves fall back) and key on that.

Consequences:
- **The `name` component is unchanged** — still a string, still serialized as
  today. No save migration, no spawn-site churn, no reader churn.
- The player has no naming entry and needs none: `playerControlled` routes it to
  second person before naming is consulted.
- An entity with no `renderable` (and so no key) falls back to its `name` string
  with default common-noun grammar.

### 5. The one forward-looking rule: entities, not strings

Call sites pass **entities** to `t()`, never pre-stringified names:

```js
// right
t('combat.melee.hit', { actor: attacker, target: defender, damage: 4 });
// wrong — defeats the grammar adapter and blocks i18n
t('combat.melee.hit', { actor: attacker.name, target: defender.name });
```

This is the cheap constraint that makes future i18n "swap the catalog + resolver"
instead of "rewrite every call site." It's the only thing adopted now purely for
i18n's sake, and it costs nothing.

### 6. Variant selection: call site picks the key

No select/plural constructs embedded in templates. Crit vs. normal, the
"hit twice for 7 total" summary, singular vs. plural — the **call site chooses
the key** (`combat.melee.hit` vs. `combat.melee.hit.crit`). Embedded ICU-style
select/plural is where heavyweight libs earn their cost; reaching for it now is
the over-engineering trap. (Verb *agreement* is the one exception, handled by the
`:v` token in §3 — it's not select/plural, it's the existing `conjugate`
behavior given a home.)

### 7. Config injection, not storage access

`text.js` never reads `localStorage`. This mirrors the audio split: the audio
*modules* expose setters and never touch persistence; `audio-settings.js` is the
wiring module that knows about both `gameSettings` and the audio layer and pushes
config in. The text analog: `text.js` exposes a loader; a wiring module (the
future locale equivalent of `audio-settings.js`) hands it the active locale.
**This pass has no locale**, so the injected config is effectively empty — but
the seam is built so the future addition is "push a locale through the existing
loader," not "teach text.js to read storage."

### 8. Missing-key behavior

A catalog fails *silently* where inline strings failed loudly. Designed in from
the first pass:

- Unknown key → render the key visibly (e.g. `«combat.melee.hit»`) and
  `console.warn` once.
- Key collision at load → throw (dev-visible).
- Missing param in a template → render a visible placeholder + warn.

---

## File Structure

```
src/text/
  text.js            # public resolver singleton: t(key, params), catalog
                     # load+merge, interpolation, missing-key handling.
  grammar.js         # English grammar adapter: entity -> noun phrase, roles,
                     # verb agreement, capitalization, articles, list-join,
                     # second person. Absorbs log-text.js. Pure functions.
  naming.js          # static naming metadata table (§4). Data, not serialized.
  catalog/
    ui.json
    combat.json
    items.json
    ai.json
    system.json
```

- `text.js` depends on `grammar.js`; `grammar.js` depends on `naming.js` and
  nothing in `text/` (it's the part most likely replaced per language — keep it
  isolated).
- `src/engine/log/text/log-text.js` is **deleted** once its callers move to
  `grammar.js`. `sound-text.js` / `smell-text.js` **stay** as domain describers
  but become callers of `t()` / the adapter, and their duplicated
  `DIRECTION_WORDS` collapses into one shared source.

---

## Build Order

Two phases. **Phase 1 ships independently and is the priority:** it proves the
resolver on the lowest-risk, highest-count surface and touches no save state and
no grammar. Phase 2 is the grammar consolidation, landed after.

### Phase 1 — Resolver + static UI

1. **Define the contract.** `t()` signature, the `{param:role}` / `{a/b:v(x)}`
   grammar (documented, even though phase 1 uses none of the entity roles), the
   missing-key behavior. Stub `text.js`.
2. **Resolver, static text only.** Catalog load + merge + scalar interpolation +
   missing-key handling, with tests (pure I/O-shaped logic → test-first per
   ADR-015). Add `catalog/ui.json`. Register the JSON in the service worker;
   bump the cache version.
3. **Migrate the static UI surface.** The ~12 files in "Where the codebase
   already is" item 5. Pure label swaps; expect a few test-literal updates.
4. **Howto + guardrails.** Add `docs/howto/text.md`; add the anti-patterns below
   to AGENTS.md.

### Phase 2 — Grammar adapter

5. **Build `grammar.js` by absorbing `log-text.js`.** Bring over
   `isPlayer/subject/object/conjugate/itemName`; add the `:v` verb token,
   `poss`, capitalization, articles, list-join. Add `naming.js`. Tests for the
   role/verb/person matrix (pure → test-first).
6. **Migrate the dynamic surfaces** onto `t()` + the adapter: combat/consume/
   drop/equip/pickup/throw/interact/death lines, then `describe-tile`,
   `sound-text`, `smell-text`. Delete the duplicated `DIRECTION_WORDS`, the
   ad-hoc `withArticle`/`joinList`/`joinNames`/`capitalize`. The capitalization
   normalization (§3) and its visible-string/test churn land here.
7. **Delete `log-text.js`.** Update `howto/logging.md` to point at the new home.
8. **Write the ADR** (below).

From phase 1 on, route all *new* text through `t()`. No big-bang rewrite of
remaining sites is required — migrate opportunistically, densest first.

---

## Guardrails / Anti-Patterns (for AGENTS.md)

- **Never pass pre-stringified entity names to `t()`.** Pass the entity; let
  `grammar.js` render it.
- **Never format an entity name or do second-person logic outside
  `grammar.js`.** Writing "you" vs "the X" anywhere else is a bug.
- **Never hand-write a user-facing literal at a call site.** It goes in a catalog
  file; the site references a key.
- **Never put grammar/naming metadata on the serialized `name` component.** It's
  static reference data — it lives in `naming.js`, keyed by type id.
- **`text.js` never reads `localStorage`.** Config is injected by the engine.
- **No select/plural syntax embedded in templates.** Call site picks the key;
  counts use `Intl.PluralRules`. The only in-template grammar is the `:v` verb
  token.
- **Grammar adapter is English-only and covers only cases that actually occur.**
  No speculative gender/case machinery — a half-built agreement engine is worse
  than the inline strings we started with.
- **Missing keys fail visibly.** Never let a lookup miss render empty or swallow.

---

## ADR to Write

**Supersede ADR-013** (don't edit it). Format per repo convention.

- **Context.** Text and the entity→noun-phrase logic that feeds it are spread
  across the UI literals and three near-duplicate `text/` modules, with copied
  formatting (articles, list-join, `DIRECTION_WORDS`) and second-person logic.
  Maintainability and standardization are the problem; i18n is explicitly not the
  driver but should remain a bounded future change.
- **Decision.** A runtime string catalog (per-domain JSON, merged at startup)
  behind a stable `t(key, params)` resolver, with a single English grammar
  adapter (`grammar.js`, absorbing the existing `log-text.js`) that renders
  entities as noun phrases. Naming metadata lives in a static side-table keyed by
  type id, *not* on the serialized `name` component. Resolution stays at the call
  site (preserving ADR-013's principle); only the literal text moves to the
  catalog. Call sites pass entities, not names.
- **Alternatives rejected** *(record so they're not relitigated)*: keeping
  hand-written literals at call sites (the status quo — the debt this fixes);
  reshaping the serialized `name` component to carry grammar (forces a save
  migration + repo-wide reader churn for data that's static-per-type); a
  build-time extraction step (violates the no-build constraint); per-locale
  catalogs now (i18n is not the goal); a heavyweight i18n framework / ICU
  embedding now (cost unjustified; the interface lets us adopt a *runtime*
  ICU/Fluent resolver later — never a build-time one); reconstructing `display`
  from structured event fields via an action→key map (couples the logger to
  catalog key naming — possible later, not the starting design).
- **Consequences.** Reading a log line now requires a jump to the catalog
  (mitigated by namespaced keys). Missing-key handling becomes load-bearing. The
  grammar adapter is a scope risk, fenced to English + occurring cases. The
  naming join key is `renderable.sprite` for now, coupling naming to the sprite
  name; the i18n-time fix is a dedicated type id stamped on instances. If
  localization becomes real, reauthor the catalog + swap the resolver; call sites
  are untouched.

---

## Path to i18n (Deferred, Runtime-Only)

Recorded so the design carries it; not built now. The payoff is that adding i18n
is a bounded, ordered change — and **every `t(key, params)` call site and the
entities-not-strings rule stay untouched throughout.** All of it stays runtime.

1. **Partition the catalog by locale.** `catalog/combat.json` →
   `catalog/en/combat.json`, `catalog/fr/combat.json`, … Keys identical across
   locales. The loader gains a locale parameter, injected by the engine (§7).
   This alone localizes all static and scalar-param text.
2. **Localize entity names.** Move `base` + grammar metadata out of `naming.js`
   into per-locale catalog entries keyed by type id. Promote the prefab id to a
   stamped `type` component so the join key is a real id, not the sprite name.
3. **Generalize the grammar adapter.** English `grammar.js` becomes one of N
   per-language adapters. This is where the real work lives: gendered articles,
   case declension, agreement. The per-locale naming metadata expands (gender,
   declension class). Nothing else in the system needs this — which is why it's
   fenced here.
4. **Upgrade the resolver only if needed.** "Call site picks the key" scales
   until a language's plural/select rules outgrow it; at that point swap
   `text.js`'s interpolation for a runtime ICU (`intl-messageformat`) or Fluent
   (`@fluent/bundle`) parser — both runtime, no build. Bounded to `text.js`.
5. **Locale selection + persistence.** The engine owns the preference
   (`localStorage`) and passes the active locale to the loader; settings gets a
   switcher. `text.js` stays storage-agnostic.

What never moves: the call sites and the entities-not-strings discipline.

---

## Out of Scope (This Pass)

- Localization, per-locale catalogs, language switching.
- ICU/Fluent template syntax (select, embedded plural).
- Non-English grammar; gender/case agreement.
- Any change to the serialized `name` component or save format.
- Logger-derives-`display`-from-structured-fields consolidation (noted as a later
  option in the ADR).
- Any build step or heavyweight runtime dependency.
</content>
</invoke>
</invoke>
