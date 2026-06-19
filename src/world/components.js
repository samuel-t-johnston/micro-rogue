// Component factory functions — the single definition site for each component's shape and defaults.
// Always create components through these functions, never as inline object literals.
// Add new components in alphabetical order and keep them sorted.
import { RenderLayers } from '../render/render-layers.js';

export const components = {
  // Ordered goal stack for an active entity. Stored as string keys resolved through
  // src/ai/goals/goal-registry.js — never function references — so the component
  // serializes cleanly. Order is priority: the evaluator runs goals top-down and
  // takes the first one that produces an action.
  //
  // `lastGoal` is the key of the goal that last produced an action for this entity
  // (null until it first acts). It drives the goalChange log's change detection and
  // the debug goal inspector; being a plain key, it serializes like `goals`.
  ai(goalNames = []) {
    return { goals: [...goalNames], lastGoal: null };
  },

  // Marks an entity as able to take the attack action. `damage` is the unarmed/base
  // attack damage; equipment and effects add to it via attributeModifiers (see the
  // attribute resolver in src/combat/attributes.js).
  attacker(damage = 0) {
    return { damage };
  },

  // Flat stat contributions a worn/held item grants its owner. Keys are attribute names
  // (currently 'attackDamage' and 'HP') summed by the attribute resolver. Stored as data
  // so items serialize cleanly; the resolver derives totals on demand — values are never
  // added to or subtracted from the owner's stored stats on equip/unequip.
  attributeModifiers(mods = {}) {
    return { ...mods };
  },

  blocksMovement() {
    return {};
  },

  container() {
    return {};
  },

  // Marks an entity as consumable (drinkable/edible/readable). The item is destroyed on use.
  // effectType is a string key into the effects registry (src/effects/effects.js);
  // params is the effect-specific payload, e.g. { amount: 10 } for heal/damage.
  // Storing the type+params as data (not a function ref) so consumables serialize cleanly.
  consumable(effectType, params = {}) {
    return { effectType, params };
  },

  // Marks an entity as a creature (actor) — a living thing with agency, as opposed to inert
  // scenery, items, or non-acting world objects. This is the source of the `isActor` sense tag
  // goals use to tell creatures from floor clutter. Kept deliberately separate from `turnTaker`:
  // taking turns is about participating in action order (a non-creature timed object could also
  // want that), while being a creature is about identity. Overloading turnTaker for both conflated
  // the two concepts.
  creature() {
    return {};
  },

  // A naturally limited lifespan, in turns. The turn loop ages a decay entity once per round
  // (see turn-manager / action-system) and destroys it when lifespan hits 0. Used for transient
  // world entities that age out on their own — sounds now; gas clouds, timed spell effects later.
  // A decay entity needs no `turnTaker`: taking turns is about acting, decaying is just aging.
  decay(lifespan) {
    return { lifespan };
  },

  // Marks an entity (which also has a position) as a place the player can arrive on this level.
  // The game scene places the player on the entryPoint entity (see src/world/spawn.js); if several
  // exist, one is chosen. Generation drops it (e.g. on the up-stairs); kept separate from the stairs
  // so pit-arrivals / multi-entry levels can mark other spots. See docs/design/procedural-3x3-dungeon.md.
  entryPoint() {
    return {};
  },

  // Marks an entity as equippable in a named slot. Slot names come from data/equipment-slots.js
  // (the Slots enum) — never bare strings — so typos crash at import time.
  // Kept separate from `item` so non-item things (future spells, innate abilities) can also be equipped.
  equippable(slot) {
    return { slot };
  },

  // One or more faction tags. Two entities are friendly if they share at least one tag;
  // hostility (no shared tag) is computed by areHostile in src/combat/factions.js.
  // A factionless entity shares nothing, so it reads as hostile to everyone.
  faction(names = []) {
    return [...names];
  },

  health(current, max) {
    return { current, max };
  },

  // Hearing acuity, paired with the `hearing` sense (in the `senses` list). `range` is how far this
  // entity hears: a sound is audible when its distance is within `range + sound.volume`. Better ears
  // = larger range; range 0 (or a missing component) = effectively deaf. Kept as a stat component so
  // it can be modified (buffs, deafening) independently of the sense faculty itself.
  hearing(range = 0) {
    return { range };
  },

  inventory(items = []) {
    return { items };
  },

  // location: { type: 'map' } | { type: 'inventory', ownerId } | { type: 'equipped', ownerId, slot } | { type: 'container', containerId }
  // Map items also carry a position component; the other types do not.
  item(location) {
    return { location };
  },

  // The set of languages this entity comprehends when it perceives a vocalization (a `sound`
  // carrying a `language`). A hearer understands a sound iff its language is in this set;
  // un-understood sounds are still heard (direction + that something was said), just not decoded.
  // Stored as a plain array so it serializes cleanly; the hearing sense reads it as a lookup.
  knownLanguages(languages = []) {
    return [...languages];
  },

  memory(initial = {}) {
    return { ...initial };
  },

  name(str) {
    return str;
  },

  // Makes an entity sometimes announce itself when it moves: executeMove rolls `chance` against the
  // shared RNG and, on success, emits a `sound` at the new tile carrying this `message` at `volume`.
  // Realizes "noisy movement" (vermin scrabbling, clanking armor) — the mover may be silent to smell
  // but loud to hearing. `message` is structured like any sound (e.g. { kind: 'vermin-scrabble' }).
  noisyMovement({ chance = 0, volume = 0, message = null } = {}) {
    return { chance, volume, message };
  },

  opaque() {
    return {};
  },

  // This is currently used for furniture like doors. For furniture with inventories 
  // (e.g. chests), use the container and inventory components instead.
  // isOpen: current state. closedSprite/openSprite: { col, row } swapped on open/close.
  openable(closedSprite, openSprite) {
    return { isOpen: false, closedSprite, openSprite };
  },

  playerControlled() {
    return {};
  },

  position(x, y) {
    return { x, y };
  },

  // sprite: { col, row } matching the sprite sheet; color: CSS fallback if sprite unavailable.
  // glyph/glyphColor: optional text character drawn over the tile when no sprite is available.
  // layer: z-order from src/render/render-layers.js — lower draws first. Omitting it
  // falls back to RenderLayers.DEFAULT (creatures, furniture); items override to ITEM
  // so a creature standing on a dropped item draws on top.
  renderable(sprite, color, glyph, glyphColor, layer = RenderLayers.DEFAULT) {
    return { sprite, color, glyph, glyphColor, layer };
  },

  // Marks an entity as a scent source: it deposits scent into level.scent each upkeep tick (see
  // src/world/scent.js). `profile` is the scent's identity — for creatures it's the faction tag, so
  // a tracker can follow hostile scent via areHostile. `intensity` is how much it lays down per tick
  // (a stronger-smelling creature leaves a denser trail). Movement isn't required: a stationary
  // source keeps a local cloud while a moving one trails a fading wake.
  scentSource({ profile = null, intensity = 0 } = {}) {
    return { profile, intensity };
  },

  // Ordered list of sense names resolved through src/ai/senses/sense-registry.js.
  // Stored as string keys (not function references) so the component serializes cleanly.
  // Each resolved sense is sense(entity, level, turnCount) → SenseResult.
  senses(senseNames = []) {
    return [...senseNames];
  },

  // Smell acuity, paired with the `smell` sense. `threshold` is the minimum scent intensity this
  // entity can detect: a keen nose has a LOW threshold (senses faint, distant scent), a dull one a
  // high threshold (only strong/near scent). A missing component means no sense of smell at all.
  smell(threshold = 0) {
    return { threshold };
  },

  // An emitted sound, carried by an invisible, short-lived entity (paired with `position` and
  // `decay`). `sourceId` is the emitter's entity id (a hearer ignores its own sounds; consumers
  // tolerate a dangling id if the source has since died). `volume` extends how far it carries
  // (audible when distance <= hearerRange + volume). `language` is the vocalization's language, or
  // null for non-verbal noise (a clang, a scream). `message` is structured semantics the AI acts on
  // — e.g. { kind: 'enemy-report', direction: 'NW' } — never raw text; display text is derived.
  sound({ sourceId = null, volume = 0, language = null, message = null } = {}) {
    return { sourceId, volume, language, message };
  },

  // Tile-level perception. visible: tiles seen this turn. memory: all ever-seen tiles → tileId.
  // Goals may read memory for navigation; renderer uses both for fog-of-war display.
  tilePerception() {
    return {
      visible: new Set(),
      memory: new Map(),
    };
  },

  // Marks a furniture entity (stairs now; pits, etc. later) as a level exit. `port` names this exit
  // in the dungeon transit map (the stairs' direction: 'up'/'down') — it's how the dungeon runtime
  // resolves where the exit leads and where the player arrives. `to` is an optional pre-resolved
  // destination, left null in the minimal cut (the transit map resolves destinations dynamically by
  // port). See docs/design/dungeon-planner.md and docs/design/procedural-3x3-dungeon.md.
  transition(to = null, port = null) {
    return { to, port };
  },

  turnTaker(speed = 1) {
    return { speed, accumulator: 0 };
  },

  // Vision acuity. `range` is the FOV radius; `undefined` (the default — and the behavior of every
  // creature predating this component) means unlimited sight. A finite range makes a creature myopic,
  // so it must lean on other senses (hearing, smell) to track what it can't currently see. Read by
  // the `vision` sense.
  vision(range = undefined) {
    return { range };
  },

  // The language this entity vocalizes in — the `language` stamped on `sound`s it emits via the
  // shout action. Its presence is also what makes a creature able to shout at all, so removing it
  // (silence) cleanly disables coordination without special-casing.
  voice(language) {
    return { language };
  },

  // An entity that wears equipment. slotNames defines the named slots available on this entity.
  // Slots hold either an entity reference or null.
  wearsEquipment(slotNames = []) {
    const slots = {};
    for (const name of slotNames) slots[name] = null;
    return { slots };
  },
};
