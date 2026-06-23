import { gameLog } from '../../engine/game-log.js';
import { describeSmell } from '../../engine/smell-text.js';

/**
 * Player goal that never acts — surfaces notable smells to the message log as a side effect, then
 * returns null so the real player goals run. Twin of player-hear. Filters out the player's own scent
 * profile and any profile smell-text deems unremarkable (describeSmell returns null). Deduped by
 * profile so a lingering scent isn't re-logged every turn; the remembered set is pruned to
 * currently-smelled profiles, so it stays bounded and a faded-then-returned scent logs again.
 */
export const playerSmell = {
  evaluate(context) {
    const { memory, perception, selfState } = context;
    const own = new Set(selfState.factions);
    const smells = (perception.smells ?? []).filter(s => !own.has(s.profile));

    const current = new Set(smells.map(s => s.profile));
    const logged = new Set((memory.smelledProfiles ?? []).filter(p => current.has(p)));

    for (const smell of smells) {
      if (logged.has(smell.profile)) continue;
      const line = describeSmell(smell);
      if (!line) continue; // not noteworthy enough to log
      gameLog.add({ action: 'smell', display: line });
      logged.add(smell.profile);
    }

    memory.smelledProfiles = [...logged];
    return null;
  },
};
