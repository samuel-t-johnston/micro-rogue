# Factions

*How the engine decides who is hostile to whom. (Small by design — this is a convention more than a system.)*

## How it works

An entity's allegiance is a `faction(['tag', ...])` component ([`components.js`](../../src/world/entities/components.js)) — a plain list of string tags. Hostility is a single rule in [`src/combat/factions.js`](../../src/combat/factions.js):

```js
areHostile(a, b) // → true when the two faction lists share NO tag
```

So two entities are **friendly if they share at least one tag**, and **hostile if they share none**. There is no registry of relationships and no neutral state — overlap is the entire model.

**The gotcha: a factionless entity (empty or missing list) shares nothing with anyone, so it reads as hostile to *everyone* — including other factionless entities.** That default is intentional and fine until a real relationship system introduces neutrals; just be aware that "no faction" means "universal enemy," not "harmless."

## Where it's consumed

Senses never decide hostility — they only report each observed entity's `factions`. **Goals** make the call, comparing the observation's factions against the actor's own via `areHostile`:

- [`attack-in-range`](../../src/ai/goals/attack-in-range.js), [`chase-others`](../../src/ai/goals/chase-others.js), [`flee-from-others`](../../src/ai/goals/flee-from-others.js) — target/avoid hostiles.
- [`shout-enemy-report`](../../src/ai/goals/shout-enemy-report.js), [`investigate`](../../src/ai/goals/investigate.js), [`track-scent`](../../src/ai/goals/track-scent.js) — react to hostiles seen, lost, or smelled.

Two adjacent uses of the same tags:

- **Scent profiles** are faction tags — a tracker follows hostile *profiles* through the scent field (see [smell.md](smell.md)).
- **Sounds** carry `sourceFactions` so a hearer can tell an ally's noise from a stranger's; combat sounds deliberately ship with *empty* source factions so a fight is worth investigating regardless of who's swinging (see [sound.md](sound.md)).

## Set it up

Give allies a shared tag and enemies disjoint ones:

```js
components.faction(['player'])     // the player
components.faction(['orcs'])       // an orc — hostile to the player, friendly to other orcs
components.faction(['orcs', 'undead']) // belongs to both camps; friendly to either
```

No registration step — tags are free-form strings; consistency between allies is the only contract.

## See also

- [AI senses](ai-senses.md) and [AI goals](ai-goals.md) — where factions are reported and acted on.
- [Creatures](creature.md) — adding the component to a monster.
