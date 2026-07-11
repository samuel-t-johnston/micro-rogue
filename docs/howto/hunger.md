# Hunger

*The hunger pool that drains each turn, the messages and damage it drives, and how to tune it or add
food. Read [attributes.md](attributes.md) first for pools and the accessors; food items are consumables
([consumable.md](consumable.md)).*

## How it works

Hunger is a **Pool attribute** (`hunger`, max increases with CON) like HP or MP — see
[attributes.md](attributes.md). What makes it a *system* is one driver and one refill:

- **The drain** — [`tickHunger`](../../src/world/systems/hunger.js) runs once per **turn-consuming**
  player action, wired from the game scene's `handleTurnEnd` (not the `upkeep` hook, which also fires on
  *free* actions like examining a tile — hunger must only cost real turns). It drains 1, announces any
  threshold crossing or eating, and — on an empty stomach — bites for damage.
- **The refill** — the **`satiate` effect** ([`effect-satiate.js`](../../src/effects/effect-types/effect-satiate.js))
  adds to the pool, mirroring how `heal` adds to HP. Food items carry it; eating one is an ordinary
  `consume` ([consumable.md](consumable.md)).

Only the player is ticked today, though any creature *can* carry a `hunger` pool (the drain is
player-gated in the game scene, not in `tickHunger` itself).

### Thresholds, messages, and starvation

`tickHunger` takes `lastHunger` (the pool at the end of the previous turn) so it can tell three cases
apart, and returns the new value for the caller to carry forward. It's **transient scene state, not
saved** — a reload re-seeds it from the current pool, so a crossing message never re-fires on load.

- **Ate** (`current` rose since last turn) → an eat message chosen by the fill reached: "stuffed" /
  "full" / "less hungry". Judged on the **pre-decay peak**, so gorging to full still reads "stuffed"
  even though this same turn's −1 drain knocks it back a point.
- **Crossed a threshold downward** → "You are hungry." (below `HUNGRY_PCT`, 40%), "You are starving."
  (below `STARVING_PCT`, 20%), "You are dying of starvation." (hit 0). Fires only on the turn the line
  is *crossed*, so sitting below it stays quiet.
- **Empty stomach** → a `STARVE_DAMAGE_CHANCE` (50%) roll each turn for 1 damage, routed through the
  **damage effect** so starvation can kill and dies like any other lethal source.

### The at-a-glance tier

[`hungerStatus(entity)`](../../src/world/systems/hunger.js) collapses the pool to `'ok'` / `'hungry'` /
`'starving'` (same boundaries as the crossing messages, so label and announcement never disagree). Two
UI surfaces read it, so a creeping starvation registers without opening a menu:

- The **HUD** shows a red `(Hungry)` / `(Starving!)` tag beside HP ([`hud.js`](../../src/ui/widgets/hud.js)).
- The game scene holds a steady red **starving vignette** while `hungerStatus === 'starving'`
  ([`vignette.js`](../../src/render/vignette.js), `setSustained`).

## Add a food item

Food is a consumable whose effect is `satiate` — the hunger-pool counterpart of `heal`
([consumable.md](consumable.md) and [item.md](item.md) for the recipe). The `params.amount` is how much
hunger it restores:

```js
components.consumable(EffectTypes.SATIATE, { amount: 100 })   // bread: a solid meal
```

Existing food — grapes (50), bread (100), meat (150) — lives in the item factories
([`items.js`](../../src/world/entities/items.js)) and the prefab pool; add yours there and it flows
through the normal loadout/floor-spawn paths. Nothing hunger-specific to wire — `executeConsume` applies
the effect, and the next `tickHunger` narrates the result off the pool rise.

## Tune it

All knobs are constants in [`hunger.js`](../../src/world/systems/hunger.js):

- **`HUNGRY_PCT` / `STARVING_PCT`** — the warning/message boundaries (fractions of max, so they scale
  with each entity's `con`-derived max).
- **Drain rate** — the `-1` in `adjustPool(player, 'hunger', -1)`; raise it for a harsher clock.
- **`STARVE_DAMAGE_CHANCE`** and the bite `amount` — how punishing an empty stomach is.
- **Max formula** — `20·con` lives in [`data/attribute-set.js`](../../data/attribute-set.js) with the
  other pool formulas.

## Worth knowing

- **Free actions don't cost hunger.** The drain is on `handleTurnEnd`, gated to turn-consuming player
  actions — examining a tile or paging a menu is free and doesn't tick.
- **Poll-not-listen, like level-up.** Threshold crossings are detected by diffing the turn's
  before/after against `lastHunger`, not by a pool-change event — the same watermark pattern the rest of
  the attribute consumers use ([attributes.md](attributes.md)).
- **Starvation death is a real damage source.** Because the bite goes through the damage effect, it runs
  the normal death path (outcome popup, save cleared) — there's no special "died of hunger" branch.
- **To make creatures hungry**, they already can carry the pool; the missing piece is ticking them —
  today `tickHunger` is called only for the player from the game scene.
