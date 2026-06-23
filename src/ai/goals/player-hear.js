import { gameLog } from '../../engine/game-log.js';
import { describeSound } from '../../engine/sound-text.js';

/**
 * Player goal that never acts — it surfaces heard sounds to the message log as a side effect, then
 * returns null so the real player goals run. Sits at the top of the player's stack precisely because
 * it always falls through: it logs every turn before movement/input is decided.
 *
 * Each sound (a short-lived entity) lingers in perception for a couple of turns, so we dedupe by the
 * sound's id, pruning the remembered set to what's currently heard — bounded, and a re-heard sound
 * id never recurs because ids aren't reused.
 */
export const playerHear = {
  evaluate(context) {
    const { memory, perception } = context;
    // Only "hear" sounds whose origin you can't currently see — a visible event speaks for itself
    // (its own log lines), so surfacing "you hear fighting" for a brawl in plain view is just noise.
    const visible = perception.visibleTiles ?? new Set();
    const sounds = (perception.sounds ?? []).filter(
      (s) => !(s.position && visible.has(`${s.position.x},${s.position.y}`)),
    );

    const currentIds = new Set(sounds.map((s) => s.soundId));
    const logged = new Set((memory.heardSoundIds ?? []).filter((id) => currentIds.has(id)));

    for (const sound of sounds) {
      if (logged.has(sound.soundId)) continue;
      gameLog.add({ action: 'hear', display: describeSound(sound) });
      logged.add(sound.soundId);
    }

    memory.heardSoundIds = [...logged];
    return null;
  },
};
