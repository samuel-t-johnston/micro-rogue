import { components } from './components.js';
import { syncSpeed } from '../../attributes/speed-sync.js';
import { getPool, setPoolCurrent } from '../../attributes/attribute-access.js';
import { HUMANOID_SLOTS } from '../../../data/equipment-slots.js';

/**
 * Creates and returns the player entity. Async so that a character creation UI can be introduced here
 * later without changing the call site in game-scene.
 */
export async function createPlayer(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Player'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('player'));
  registry.addComponent(entity, 'position', components.position(x, y));
  // Full stat block. The four ability scores start at 5 each — a low baseline that level-up growth
  // (below) builds on. spd=1 is the ~1.0 turn-speed scale (1 action/round); it feeds turnTaker.speed
  // via syncSpeed below, with dex adding a small nimbleness bonus. hpBase is the raw HP floor that
  // equipment and 2·con add onto (maxHP = hpBase + equip + 2·con = 20 + 10 at con 5); current is absent
  // so it spawns full. attack=1 is the unarmed damage, xp=0 starts at level 1. See
  // docs/design/attribute-system.md.
  registry.addComponent(
    entity,
    'attributes',
    components.attributes({
      str: 5,
      dex: 5,
      int: 5,
      con: 5,
      spd: 1,
      attack: 1,
      hpBase: 20,
      mpBase: 1,
      xp: 0,
    }),
  );
  // Grows on level-up: one point per level, split evenly STR → DEX → CON (INT left out for now), up to
  // level 25. The level-up system (src/world/systems/level-up.js) watches this and allocates the points.
  registry.addComponent(
    entity,
    'levelUp',
    components.levelUp({
      dynamic: true,
      points: 1,
      attributePercentages: { str: 0.33, dex: 0.33, con: 0.33, int: 0 },
      maxLevel: 25,
    }),
  );
  // Start the player fully fed: seed the hunger current to its derived max (10·con). Storing the
  // current also makes hasPool('hunger') true, so the satiate/decay guards find the pool. maxHP is
  // left unseeded (an absent pool current reads as full), but hunger stores a value so it can drain.
  setPoolCurrent(entity, 'hunger', getPool(entity, 'hunger').max);
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  syncSpeed(entity); // seed turnTaker.speed from spd + dex so the first turn uses the derived value
  registry.addComponent(entity, 'creature', components.creature());
  registry.addComponent(entity, 'playerControlled', components.playerControlled());
  registry.addComponent(entity, 'attacker', components.attacker()); // can-attack marker
  registry.addComponent(entity, 'faction', components.faction(['player']));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory());
  registry.addComponent(entity, 'senses', components.senses(['vision', 'hearing', 'smell']));
  registry.addComponent(entity, 'hearing', components.hearing(6));
  registry.addComponent(entity, 'smell', components.smell(5)); // dull nose — only strong/near scent
  registry.addComponent(
    entity,
    'scentSource',
    components.scentSource({ profile: 'player', intensity: 10 }),
  );
  // The player starts knowing no other languages — orc shouts read as untranslated noise until a
  // language is learned (a future hook), which is exactly when the log starts decoding them.
  registry.addComponent(entity, 'knownLanguages', components.knownLanguages([]));
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(
    entity,
    'ai',
    components.ai([
      'player-hear',
      'player-smell',
      'player-auto-move',
      'player-auto-pickup',
      'player-get-input',
    ]),
  );
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('player', '#0a1a0a', '@', '#00cc44'),
  );
  return entity;
}

/**
 * Sample constructor for the player, keyed by label — a canonical instance at the origin, so content
 * enumeration (e.g. the sprite/glyph coverage test) can treat the player uniformly with creatures and
 * items. `make` is async, matching createPlayer.
 */
export const PLAYER_SAMPLE = {
  player: (r) => createPlayer(r, 0, 0),
};
