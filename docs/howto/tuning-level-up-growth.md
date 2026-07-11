# Level-up attribute growth

*How an entity's attributes grow as its Level rises, and how to tune or swap that. Read [the attribute system design](../design/attribute-system.md) first for Level, XP, and the accessors.*

## How it works

Two pieces, and they are the *whole* mechanic — swapping how level-up rewards work should only touch these:

- **The `levelUp` component** ([`components.js`](../../src/world/entities/components.js)) marks an entity as one that grows on level-up and carries the spec:

  ```js
  components.levelUp({
    dynamic: true,                                       // grow mid-game as XP is earned?
    points: 1,                                           // points granted per level
    attributePercentages: { str: 0.33, dex: 0.33, con: 0.33, int: 0 }, // target split
    maxLevel: 25,                                        // growth stops here
  })
  ```

- **The level-up system** ([`level-up.js`](../../src/world/systems/level-up.js)) is a turn-boundary *watch*. `watchLevelUp(entity)` is called for the acting entity at each turn end (wired in [`game-scene.js`](../../src/ui/scenes/game-scene.js)); it diffs the entity's derived Level against the watermark `lastLevel` stored on the component and, for each level crossed, allocates points.

Level derives from XP (see [`data/attribute-set.js`](../../data/attribute-set.js)), which accrues on kills, so a level-up is detected the turn after the kill that caused it — poll-not-listen, the same pattern as hunger.

### How points are allocated

`distributeLevelUpPoints(attributePercentages, totalPoints)` places points one at a time. For each point it walks the attributes **in declared order** and gives it to the first whose running allocation is still below its target share of the points placed so far. A zero share (`int: 0`) never receives one. So an even `str/dex/con` split round-robins STR → DEX → CON → STR → …

The distribution is a pure function of the point count, so the watcher applies the *delta* between the distribution at the old and new levels — the round-robin phase carries correctly across separate level-ups and across a multi-level jump.

## Tune the player's growth

Edit the `levelUp` component in [`player.js`](../../src/world/entities/player.js) — change the split, the points per level, or the cap. To bias toward strength, for example: `{ str: 0.5, dex: 0.25, con: 0.25 }`. Any attribute score can appear in the split.

## `dynamic: false` — scaling creatures at spawn

A `dynamic: false` entity keeps its spec but does **not** grow as it earns XP. Creatures use this: each is authored with **level-1 base stats** and a `dynamic: false` spec (see [`creatures.js`](../../src/world/entities/creatures.js)), and a map-generation stage boots them to a per-floor level.

**The `scaleCreatures` stage** ([`stage-scale-creatures.js`](../../src/world/generation/stages/stage-scale-creatures.js)) takes a `levels` map of `entityTypeId → level`:

```js
{ type: 'scaleCreatures', levels: { goblin: 2, orc: 2, scuttler: 2, orcCommander: 2 } }
```

For each placed creature whose type is named, it sets `xp` to that level's threshold (so the creature reads as that level for display **and** for the XP it's worth when killed) and runs `applyLevelUps` — the same allocator the player's growth uses — for the attribute gains. It only touches `dynamic: false` creatures, so the player (dynamic) is never pre-scaled; a configured type absent from the floor is skipped, and a placed creature not in the config is left alone. Add it to a floor's pipeline after the creatures are placed (see [`data/pipelines/`](../../data/pipelines/)); floor 1 omits it, so its monsters stay at level 1.

This is the tuning workflow: **balance a creature at level 1** in `creatures.js`, choose its scaling split, and let each floor's `scaleCreatures` config decide how deep-floor copies grow.

## Worth knowing

- **`lastLevel` is the watermark, stored on the component.** It starts at the entity's spawn level (1 for the player) and serializes as plain data. Because allocated points are baked into the score bases and saved alongside it, a reload never re-pays points.
- **No pools are refilled on level-up.** A CON gain raises max HP; the non-destructive pool clamp means current HP simply has more headroom. Healing-on-level-up, effects, and sounds are future bells and whistles — `level-up.js` is where they hang.
- **The player's level-up is announced** with the level reached and the attributes gained ("You reach level 3! +1 STR, +1 CON"), plus a gold screen-edge vignette ([`vignette.js`](../../src/render/vignette.js)). Both fire from `announceLevelUp` in `level-up.js`, gated to the player; creatures grow silently.
