# Game Architecture: Map, Tiles, and Entities
Purpose: Initial architecture overview for ROGµE.

## Core Principle: Everything (except terrain) is an Entity

Items, furniture, and creatures share the same data structure. The distinction between them is semantic (`entity.kind`), not structural. Capability components govern behavior — don't build separate class hierarchies for doors vs. swords vs. monsters.

---

## The Three Layers

**1. Base tile layer** — static, compact terrain data (type IDs, ideally a typed array for performance). Stores passability, opacity, and terrain type. Fast to query for pathfinding and FOV.

**2. Tile override layer** — sparse map of mutations (`"x,y" → tile object`). Handles dynamic terrain: digging, flooding, collapsing floors. Only exists where terrain has actually changed. `getTile(x,y)` checks overrides first, falls back to base.

**3. Entity layer** — everything else. Indexed by ID, with a spatial index (`Map<"x,y", Entity[]>`) for position lookups.

---

## Tiles: Data with Effect Hooks, Not Actors

Tiles don't act — they're polled or trigger effects when entered. Terrain effects (lava burns, water drowns) live as properties on the tile type definition. The movement system reads `tile.enterEffect` and dispatches to the action system. Tiles never execute logic themselves.

```javascript
{
  type: 'lava',
  passable: true,
  opaque: false,
  enterEffect: 'burn',
  itemEffect: 'melt',
  flightIgnores: true,
}
```

When terrain needs ongoing state (fire burning out, a magical field losing charges), use a **stationary entity** on top of the tile rather than mutating the tile itself.

**Rule of thumb:** if it has a *turn*, it's an entity. If it's a *property of the location*, it's tile data.

---

## Entities: Passive vs. Active

Creatures, items, and furniture are all entities. The only structural difference:

- **Active entities** (creatures) have `AI` and `TurnTaker` components
- **Passive entities** (items, furniture) don't — they get acted upon, or act as intermediaries

Passive entities can still have limited turn behavior when needed (burning item ticking down, door closing on a timer) — they just get a `TurnTaker` added temporarily or conditionally.

---

## Capability Components

Behavior is driven by presence of components, not type hierarchies:

- `openable` — doors, chests, gates
- `container` — chests, bags, corpses
- `equippable`, `usable`, `throwable` — item interactions
- `health`, `combatStats` — anything that can be fought
- `AI` — anything that acts autonomously
- `blockMovement`, `blockLight` — spatial properties shared across all kinds

The action system checks component presence: `if (target.openable) → openAction()`. A trapped chest that fights back just gets `combatStats` added — no new class needed.

---

## Item Location Model

Items can exist in multiple contexts. Model location as a discriminated union, not just `{x, y}`:

```javascript
location: { type: 'map', x, y }
location: { type: 'inventory', ownerId }
location: { type: 'equipped', ownerId, slot }
location: { type: 'container', containerId }
```

This handles edge cases cleanly: items in carried containers, equipment dropped on death, nested inventories.

---

## What to Avoid

- Deep inheritance hierarchies for game object types
- Storing behavior on tiles (tiles are data, systems have logic)
- Assuming items always have map coordinates
- Making every tile mutable — use the sparse override layer instead