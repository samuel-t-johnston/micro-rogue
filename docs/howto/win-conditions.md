# Win Conditions

*How a run is won, and how to add your own victory condition. The losing side (player death) is documented at [`src/combat/death.js`](../../src/combat/death.js); both ends of a run converge on one handler — see "End of run" below.*

## How it works

Victory is decided by a registry of **win conditions** in [`src/engine/win-conditions.js`](../../src/engine/win-conditions.js), mirroring the [`upkeep`](../../src/engine/upkeep.js) and goal/effect registries. Each condition is a function:

```js
fn({ registry, level, player }) -> null | { outcome: 'win', message }
```

`null` means "keep playing"; a non-null result ends the run. The game scene evaluates all conditions at the **end of each real (non-free) player turn** — the only moment win state can change — via the turn manager's `onTurnEnd` hook, and routes the first hit into its single `endGame()` seam.

The shipped condition is the classic escape: stand on a `dungeonExit` tile while carrying the **Amulet of Yendor**. It's built from a reusable factory:

```js
winConditions.register('escape-with-amulet',
  escapeWithQuestItem('amulet-of-yendor', 'You escaped the dungeon with the Amulet of Yendor!'));
```

Registration happens in `game-scene.js`'s `mountLevel`, so the check is live on every floor.

## The pieces

- **`questItem(id)` component** ([`components.js`](../../src/world/components.js)) — tags an item as an objective. The `id` (e.g. `'amulet-of-yendor'`) gives each quest item a distinct identity, so one component serves many. Conditions key on the **id, never the display name**.
- **`dungeonExit()` component** — a plain marker on the surface up-stairs (the win tile). Read by position; decoupled from how the exit was placed.
- **Amulet** — `createAmulet` in [`items.js`](../../src/world/items.js): a plain carried item (no consumable/equippable behavior) with the `questItem('amulet-of-yendor')` tag.
- **Dungeon exit** — `createDungeonExit` in [`furniture.js`](../../src/world/furniture.js): normal up-stairs plus the `dungeonExit` marker. Placed explicitly by whoever authors the top level — there is no auto-detection, so multiple exits are fine (any one satisfies the win).

## Placement

- **Static floors** (e.g. `floor-1-a`): author a `{ type: 'dungeonExit', x, y }` entity in the map. [`stage-place-static-entities`](../../src/world/generation/stages/stage-place-static-entities.js) instantiates it and makes it double as the player's `entryPoint`: the player starts here (no Amulet yet, so no win), descends, and — climbing back up from below they arrive on floor-1's stairs-**down** (the `'down'` port of the bidirectional edge in [`data/transit-map.js`](../../data/transit-map.js)) — must navigate back to the exit carrying the Amulet to escape.
- **Procedural floors**: the amulet is placed by label. Add `'amulet'` to the `label` stage's `labels` parameter (it is **not** a default — see [`procedural-3x3.js`](../../data/pipelines/procedural-3x3.js)); [`stage-populate`](../../src/world/generation/stages/stage-populate.js) then drops one amulet on the centermost tile of the `amulet`-labelled room (deterministic and guaranteed, since the game is unwinnable without it).

## End of run

Both player death and victory call `endGame({ outcome, message })` in [`game-scene.js`](../../src/ui/game-scene.js): it deletes the save (the run is over either way), freezes the turn loop, and shows the [outcome popup](../../src/ui/outcome-popup.js) (`'You Died'` / `'You Escaped!'`). Dismissing it advances to the Results scene, which shows the outcome heading and message. Detection differs by necessity — death is event-driven and immediate (a corpse must stop acting at once), win is polled at turn-end — but they share this one handler.

## Add your own

1. Tag the relevant item(s) with `questItem('your-id')`, or invent another component your condition reads.
2. Register a condition in `mountLevel` that returns `{ outcome: 'win', message }` when satisfied. Use `escapeWithQuestItem('your-id', '…')` for a carry-to-the-exit objective, or write a fresh `fn({ registry, level, player })` for anything else (kill a boss, survive N turns, reach a depth, …).
