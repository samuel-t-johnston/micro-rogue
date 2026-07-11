/**
 * @file Salience monitor: the shared "did the settled world change in a way the player should look at"
 * detector, read by both auto-move cancellation and the in-menu warning (and, later, auto-rest /
 * travel / the notification layer). It is deliberately *not* a pure "is the world dangerous" predicate —
 * every consumer cares about **change** against a remembered baseline, not absolute state: a monster
 * already in view when auto-move armed is no reason to stop; a *new* one is.
 *
 * Two stateless operations over the planning-context shape both consumers already hold
 * (`{ perception, selfState }`): `snapshot` captures the salient facts (perceived-hostile ids + current
 * HP), and `diff` compares a baseline against the current context and reports whether — and why — an
 * alert-worthy change occurred. Consumers own their baseline's lifecycle (auto-move fixes it at arming;
 * the menu advances it each turn); the monitor holds no state between calls. Conditions are a closed set
 * defined here, not registered per-consumer — every consumer wants the same answer. See
 * docs/design/state-change-alerts.md.
 */
import { areHostile } from '../../combat/factions.js';

// The perceived hostile actors in a context: actors whose factions share nothing with the viewer's.
// Same predicate the player goals use, kept here so both consumers read one definition of "hostile".
function perceivedHostileIds({ perception, selfState }) {
  return perception.entities
    .filter((e) => e.tags.isActor && areHostile(selfState.factions, e.factions))
    .map((e) => e.entityId);
}

/**
 * Captures the salient facts of the current context as a baseline: the ids of perceived hostiles and
 * the viewer's current HP. Plain data, so a consumer can stash it in memory across turns.
 */
export function snapshot(context) {
  return { enemyIds: perceivedHostileIds(context), hp: context.selfState.hp };
}

/**
 * Compares `baseline` (from a prior `snapshot`) against the current context and reports the
 * alert-worthy changes. Conditions (the whole closed set):
 *  - `newHostile` — a hostile perceived now that was absent from the baseline (one reason per new id).
 *  - `hpDrop` — current HP below the baseline's, by any amount.
 * A missing/partial baseline is inert (no alert) so a mid-move save lacking the key degrades cleanly.
 * @returns {{ alerted: boolean, reasons: object[] }}
 */
export function diff(baseline, context) {
  const reasons = [];
  if (!baseline) return { alerted: false, reasons };

  const known = new Set(baseline.enemyIds ?? []);
  for (const id of perceivedHostileIds(context)) {
    if (!known.has(id)) reasons.push({ type: 'newHostile', id });
  }

  const hp = context.selfState.hp;
  if (baseline.hp != null && hp != null && hp < baseline.hp) {
    reasons.push({ type: 'hpDrop', current: hp, previous: baseline.hp });
  }

  return { alerted: reasons.length > 0, reasons };
}
