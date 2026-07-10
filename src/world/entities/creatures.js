import { components } from './components.js';
import { syncSpeed } from '../../attributes/speed-sync.js';
import { HUMANOID_SLOTS } from '../../../data/equipment-slots.js';

/** Creates a Goblin: a basic melee creature that attacks adjacent foes, flees when outmatched, else wanders. */
export function createGoblin(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Goblin'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('goblin'));
  registry.addComponent(entity, 'position', components.position(x, y));
  // Level-1 base stats: a weak, lightly-built melee grunt (weaker than the player at equal level). Its
  // level-up growth (below) is a rounded STR/CON spread, so deeper-floor goblins hit a bit harder and
  // last a bit longer. spd=1 is the ~1.0 turn-speed scale, fed into turnTaker.speed by syncSpeed; xp 0 →
  // level 1. The scaleCreatures map-gen stage boots it to the floor's level. See docs/design/attribute-system.md.
  registry.addComponent(
    entity,
    'attributes',
    components.attributes({
      str: 3,
      dex: 3,
      int: 2,
      con: 3,
      spd: 1,
      attack: 1,
      hpBase: 1,
      mpBase: 1,
      xp: 0,
    }),
  );
  registry.addComponent(
    entity,
    'levelUp',
    components.levelUp({
      dynamic: false,
      points: 1,
      attributePercentages: { str: 0.5, con: 0.5 },
      maxLevel: 30,
    }),
  );
  registry.addComponent(entity, 'attacker', components.attacker());
  registry.addComponent(entity, 'faction', components.faction(['goblins']));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  syncSpeed(entity);
  registry.addComponent(entity, 'creature', components.creature());
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory());
  registry.addComponent(entity, 'senses', components.senses(['vision']));
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(
    entity,
    'ai',
    components.ai(['attack-in-range', 'flee-from-others', 'wander-aimlessly']),
  );
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('goblin', '#0a1a0a', 'g', '#2ecc40'),
  );
  return entity;
}

/** Creates an Orc: a tougher melee creature that hears, chases, obeys orcish shouts, and investigates lost foes. */
export function createOrc(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Orc'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('orc'));
  registry.addComponent(entity, 'position', components.position(x, y));
  // Level-1 base stats: a solid melee soldier, a roughly even match for the player at equal level (hits
  // about as hard, a little less HP). Rounded STR/CON growth. xp 0 → level 1;
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
      hpBase: 5,
      mpBase: 1,
      xp: 0,
    }),
  );
  registry.addComponent(
    entity,
    'levelUp',
    components.levelUp({
      dynamic: false,
      points: 1,
      attributePercentages: { str: 0.5, con: 0.5 },
      maxLevel: 30,
    }),
  );
  registry.addComponent(entity, 'attacker', components.attacker());
  registry.addComponent(entity, 'faction', components.faction(['orcs']));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  syncSpeed(entity);
  registry.addComponent(entity, 'creature', components.creature());
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory({ remembersEnemies: true }));
  registry.addComponent(entity, 'senses', components.senses(['vision', 'hearing']));
  registry.addComponent(entity, 'hearing', components.hearing(6));
  registry.addComponent(entity, 'knownLanguages', components.knownLanguages(['orcish']));
  registry.addComponent(
    entity,
    'scentSource',
    components.scentSource({ profile: 'orcs', intensity: 10 }),
  );
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  // equip-weapon arms it from inventory (a spear) before combat; below chase/attack: hears an
  // understood report and converges; investigates a lost trail before giving up.
  registry.addComponent(
    entity,
    'ai',
    components.ai([
      'equip-weapon',
      'attack-in-range',
      'chase-others',
      'obey-shouts',
      'investigate',
      'explore-doors-eager',
      'wander-aimlessly',
    ]),
  );
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('orc', '#0a1a0a', 'o', '#e74c3c'),
  );
  return entity;
}

/**
 * Creates an Orc Commander that coordinates the squad: it speaks orcish (`voice`) and, on spotting a
 * hostile, shouts the foe's direction (the `shout-enemy-report` goal sits atop its combat goals).
 * Other orcs in earshot that understand orcish obey via `obey-shouts`.
 */
export function createOrcCommander(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Orc Commander'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('orcCommander'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(
    entity,
    'attributes',
    // Level-1 base stats: a tougher, bow-wielding leader — more HP than a rank-and-file orc and ranged
    // pressure, so it reads as a step above the player at equal level. Growth is DEX/CON (its bow shots
    // scale on DEX, HP on CON). xp 0 → level 1; the scaleCreatures stage boots it to the floor's level.
    // (Was authored at level 3; now baselined to 1 like every creature.)
    components.attributes({
      str: 3,
      dex: 7,
      int: 7,
      con: 7,
      spd: 1,
      attack: 1,
      hpBase: 8,
      mpBase: 1,
      xp: 0,
    }),
  );
  registry.addComponent(
    entity,
    'levelUp',
    components.levelUp({
      dynamic: false,
      points: 1,
      attributePercentages: { dex: 0.5, con: 0.5 },
      maxLevel: 30,
    }),
  );
  registry.addComponent(entity, 'attacker', components.attacker());
  registry.addComponent(entity, 'faction', components.faction(['orcs']));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  syncSpeed(entity);
  registry.addComponent(entity, 'creature', components.creature());
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory({ remembersEnemies: true }));
  registry.addComponent(entity, 'senses', components.senses(['vision', 'hearing']));
  registry.addComponent(entity, 'hearing', components.hearing(6));
  registry.addComponent(entity, 'knownLanguages', components.knownLanguages(['orcish']));
  registry.addComponent(entity, 'voice', components.voice('orcish'));
  registry.addComponent(
    entity,
    'scentSource',
    components.scentSource({ profile: 'orcs', intensity: 10 }),
  );
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(
    entity,
    'ai',
    components.ai([
      'shout-enemy-report',
      'equip-weapon',
      'equip-ammo',
      'attack-in-range',
      'chase-others',
      'obey-shouts',
      'investigate',
      'explore-doors-eager',
      'wander-aimlessly',
    ]),
  );
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('orc-commander', '#0a1a0a', 'O', '#ff6b5b'),
  );
  return entity;
}

/**
 * Creates a Scuttler: weak, fast vermin that swarms and hunts by scent. Its sight reaches only 3
 * tiles, so among the pillars it constantly loses the player and falls back on tracking their scent
 * trail. It emits no scent itself, but its scuttling is noisy — movement sometimes betrays it to hearing.
 */
export function createScuttler(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Scuttler'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('scuttler'));
  registry.addComponent(entity, 'position', components.position(x, y));
  // Level-1 base stats: all speed and bite, no toughness — the lowest CON and HP of any creature, so it
  // dies to a single hit but swarms and strikes fast. spd=1.4 carries the scuttling speed advantage
  // (fed into turnTaker.speed by syncSpeed, plus dex's nimbleness bonus). Its level-up growth is a
  // STR/DEX split — sharper and faster with depth, never sturdier. xp 0 → level 1; the scaleCreatures
  // stage boots it to the floor's level.
  registry.addComponent(
    entity,
    'attributes',
    components.attributes({
      str: 6,
      dex: 10,
      int: 1,
      con: 1,
      spd: 1.4,
      attack: 1,
      hpBase: 1,
      mpBase: 1,
      xp: 0,
    }),
  );
  registry.addComponent(
    entity,
    'levelUp',
    components.levelUp({
      dynamic: false,
      points: 1,
      attributePercentages: { str: 0.5, dex: 0.5 },
      maxLevel: 30,
    }),
  );
  registry.addComponent(entity, 'attacker', components.attacker());
  registry.addComponent(entity, 'faction', components.faction(['scuttlers']));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  syncSpeed(entity);
  registry.addComponent(entity, 'creature', components.creature());
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'memory', components.memory({ remembersEnemies: true }));
  registry.addComponent(entity, 'senses', components.senses(['vision', 'smell']));
  registry.addComponent(entity, 'vision', components.vision(3)); // myopic
  registry.addComponent(entity, 'smell', components.smell(0.3)); // keen nose: low threshold
  registry.addComponent(
    entity,
    'noisyMovement',
    components.noisyMovement({ chance: 0.5, volume: 4, message: { kind: 'vermin-scrabble' } }),
  );
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(
    entity,
    'ai',
    components.ai([
      'attack-in-range',
      'chase-others',
      'track-scent',
      'investigate',
      'wander-aimlessly',
    ]),
  );
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('scuttler', '#0a1a0a', 's', '#c2a04a'),
  );
  return entity;
}

// When you add a creature factory above, register it in src/world/entities/entity-prefabs.js — that catalog
// is the single source of truth for spawnable types, and entity-prefabs.test.js fails if you forget.
