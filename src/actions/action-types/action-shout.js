import { emitSound } from '../../world/sounds.js';

// Emits a sound entity at the actor's tile encoding a structured message (e.g. an enemy report).
// The actor's `voice` supplies the language the sound is stamped with — and its presence is what
// makes the actor able to shout at all: a voiceless (or silenced) actor produces no sound, though
// the action still consumes its turn. Volume, message, and lifespan come from the action, which the
// shouting goal builds. The player perceives shouts through the hearing sense, not this emission,
// so nothing is logged here. Returns false — shouting consumes the turn.
export function executeShout(actor, action, level, registry) {
  const voice = actor.components.get('voice');
  const pos = actor.components.get('position');
  if (voice && pos) {
    emitSound(registry, level, {
      sourceId: actor.id,
      x: pos.x,
      y: pos.y,
      volume: action.volume ?? 0,
      language: voice.language,
      message: action.message ?? null,
      lifespan: action.lifespan ?? 2,
    });
  }
  return false;
}
