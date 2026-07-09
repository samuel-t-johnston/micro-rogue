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

## `dynamic: false` — the spawn-scaling seam

A `dynamic: false` entity keeps its spec but does **not** grow as it earns XP. This is the hook for the (upcoming) creature spawn-scaling feature: author a monster's base stats and its level-up split, then boot it to a target level at spawn by running the same allocator over `(level − 1) × points` points. The watcher deliberately ignores it so a scaled-up monster doesn't also creep upward from the odd XP it earns fighting.

## Worth knowing

- **`lastLevel` is the watermark, stored on the component.** It starts at the entity's spawn level (1 for the player) and serializes as plain data. Because allocated points are baked into the score bases and saved alongside it, a reload never re-pays points.
- **No pools are refilled on level-up.** A CON gain raises max HP; the non-destructive pool clamp means current HP simply has more headroom. Healing-on-level-up, effects, and sounds are future bells and whistles — `level-up.js` is where they hang.
- **A save-affecting change needs a migration.** Adding `levelUp` to the player shipped as the `v10 → v11` migration (see [saving.md](saving.md)); it seeds `lastLevel` from each player's current level so no points are back-paid on load.
