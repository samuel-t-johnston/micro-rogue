/**
 * @file Re-entry policies: how a revisited floor's frozen blob becomes the live level to arrive on.
 *
 * Cold storage freezes a floor when the player leaves it; on return, its transit-map node's `reentry`
 * policy decides what to do with that frozen blob. `thaw` (the default) restores it exactly as frozen;
 * `regen` throws it away and rebuilds the floor from scratch on an incremented epoch, so the layout
 * differs deterministically (see docs/design/reentry-pipelines.md). Selective-mutation policies —
 * transforming a thawed level in place — slot in here later by registering another name; the registry
 * is the seam that keeps `travel()` uniform (it looks up a policy, it never branches on one).
 *
 * A policy is `async (blob, node, context) -> { level, playerMemory, carriedOver? }`:
 *   - `blob`    — the frozen floor record ({ level, entities, playerMemory, frozenAtTurn }).
 *   - `node`    — the destination transit-map node (regen rebuilds from its identity).
 *   - `context` — { registry, generate }: the live registry and the epoch-aware floor generator.
 *   - returns   — the live level; the fog-of-war to lay back down (the frozen memory for a restored
 *                 layout, or `null` to start dark when freshly built); and `carriedOver`, entities the
 *                 caller must re-place on the player's arrival tile (regen's quest-item survivors).
 */
import { thawLevel } from './cold-storage.js';
import { collectSubgraph } from './subgraph.js';

async function thaw(blob, _node, { registry }) {
  return { level: thawLevel(blob, registry), playerMemory: blob.playerMemory };
}

async function regen(blob, node, { registry, generate }) {
  // Total reset with one exception: entities carrying a `questItem` component are carried across so a
  // dropped Amulet of Yendor can't be destroyed into an unwinnable save (the soft-lock guard — see
  // docs/design/reentry-pipelines.md). Everything else is discarded and the floor is rebuilt on the
  // next epoch, so it differs deterministically from the visit before. The old layout is gone, so its
  // remembered tiles are meaningless — arrive in the dark, exactly like a first visit.
  const carriedOver = extractQuestItems(blob, registry);
  const epoch = (blob.level?.epoch ?? 0) + 1;
  return { level: await generate(node, epoch), playerMemory: null, carriedOver };
}

/**
 * Pulls the quest-item sub-graphs out of a frozen floor's blob, leaving them live in `registry`, and
 * destroys the rest of the floor. Works on the real entities (not a re-mint) so any state a quest item
 * holds — and anything it contains — is preserved: thaw the whole blob, keep every entity reachable
 * from a `questItem`, destroy the remainder. Returns the top-level quest items for the caller to place
 * on the arrival tile. An entity-less floor short-circuits (nothing to preserve, nothing to thaw).
 * The guard looks like dead code — generation never *places* a quest item on a regenerating floor —
 * but the player can drop one there, so it protects a live path.
 */
function extractQuestItems(blob, registry) {
  if (!blob.entities?.length) return [];

  const level = thawLevel(blob, registry); // the thawed level is discarded; we keep only the survivors
  const all = collectSubgraph(level.entities);
  const questItems = [...all].filter((e) => e.components.has('questItem'));

  const keep = new Set();
  for (const item of questItems) for (const e of collectSubgraph([item])) keep.add(e);
  for (const e of all) if (!keep.has(e)) registry.destroyEntity(e);

  return questItems;
}

const POLICIES = { thaw, regen };

/** The policy a node uses when its `reentry` field is absent — restore the floor exactly as frozen. */
export const DEFAULT_POLICY = 'thaw';

/** Returns the re-entry handler for a policy name (defaulting to `thaw`); throws on an unknown one. */
export function getReentryPolicy(name = DEFAULT_POLICY) {
  const policy = POLICIES[name];
  if (!policy) throw new Error(`Unknown reentry policy: "${name}"`);
  return policy;
}
