# Consumables

*Consumable-specific item behaviour, plus the effects registry it relies on. Read [item.md](item.md) first for the generic item recipe.*

## How it works

A consumable is an item carrying a **`consumable`** component, which stores a string `effectType` and a `params` payload:

```js
components.consumable(EffectTypes.HEAL, { amount: 10 })
```

**The consume action** — [`action-consume.js`](../../src/actions/action-types/action-consume.js) — looks up the item in the actor's inventory, applies its effect, logs the use, then removes the item and destroys the entity. (It logs *before* destroying, so the item's `name` is still intact.)

**The effects registry** — [`src/effects/effects.js`](../../src/effects/effects.js) — maps `effectType` keys to handler functions sharing the signature `(user, target, params, level, registry) → void`. The consumable stores the *key* (not a function reference) so it serializes cleanly; `applyEffect` resolves it at use time. Two effects exist today:

| Effect | Handler |
|---|---|
| `heal` | [`effect-heal.js`](../../src/effects/effect-heal.js) |
| `damage` | [`effect-damage.js`](../../src/effects/effect-damage.js) |

## Add a new consumable

Follow the [item.md](item.md) recipe, then add the consumable component:

```js
registry.addComponent(entity, 'item', components.item(location));
registry.addComponent(entity, 'consumable', components.consumable(EffectTypes.HEAL, { amount: 25 }));
```

If the effect you need doesn't exist yet, add it to the effects registry:

1. Write a handler in `src/effects/` with the `(user, target, params, level, registry)` signature.
2. Register it in the `EFFECTS` map and add a key to `EffectTypes` in [`src/effects/effects.js`](../../src/effects/effects.js).

## Worth knowing

- **`target` is optional.** Drinking is self-targeted (`target` is `null`). The handler signature already carries a `target` so a future "throw potion" action can route a different target through the same effect — see the note in [`action-consume.js`](../../src/actions/action-types/action-consume.js).
- **The item is destroyed on use** — consumables are single-use by definition.
- **Effects are documented here on purpose.** The registry currently has one consumer (consumables) and two trivial, instantaneous effects — no durations, stacks, or status effects. When a second consumer appears (traps, thrown items, spells) or effects gain state, split effects into its own `effects.md`. Until then, don't over-design it.
