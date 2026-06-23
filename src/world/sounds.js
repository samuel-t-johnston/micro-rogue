import { components } from './components.js';

/**
 * Emits a sound into the world: an invisible, short-lived entity carrying `sound` + `decay` at
 * (x, y). It has no `renderable`, `blocksMovement`, or `creature` — it's perceived only through the
 * hearing sense and ages out via the turn loop's decay handling. Sounds are generated explicitly by
 * actions (a shout, noisy movement); this is the single creation site.
 */
export function emitSound(
  registry,
  level,
  {
    sourceId = null,
    x,
    y,
    volume = 0,
    language = null,
    message = null,
    sourceFactions = [],
    lifespan = 2,
  },
) {
  const sound = registry.createEntity();
  registry.addComponent(sound, 'position', components.position(x, y));
  registry.addComponent(
    sound,
    'sound',
    components.sound({ sourceId, volume, language, message, sourceFactions }),
  );
  registry.addComponent(sound, 'decay', components.decay(lifespan));
  level.placeEntity(sound);
  return sound;
}
