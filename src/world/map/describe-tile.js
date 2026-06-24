/**
 * @file Builds the player-facing sentence for the "look at" action: what the viewer knows about a
 * tile, tiered by fog-of-war. Pure (no logging) so it's unit-testable; action-look.js does the logging.
 *
 *   currently visible → full truth: "You see an Orc and an open door."
 *   remembered (seen, now in fog) → terrain + remembered furniture only: "You remember a door there."
 *   never seen → "You can't see there."
 *
 * Creatures and items aren't remembered (they move / get taken), so the remembered tier names only
 * persistVisible furniture — read from the live entities, which for static furniture still stand where
 * they were last seen. Terrain in the remembered tier comes from the snapshot in `memory`.
 */
import { getTileType } from './tile-registry.js';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const withArticle = (noun) => `${VOWELS.has(noun[0]?.toLowerCase()) ? 'an' : 'a'} ${noun}`;

// "a" · "a and b" · "a, b, and c"
function joinList(parts) {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

// Examination order on a tile: creatures, then items, then furniture.
const rank = (e) => (e.components.has('health') ? 0 : e.components.has('item') ? 1 : 2);

// A complete noun phrase for one entity, e.g. "an Orc", "an open door", "stairs leading down".
function entityPhrase(e) {
  if (e.components.has('transition')) {
    return `stairs leading ${e.components.get('transition').port === 'down' ? 'down' : 'up'}`;
  }
  const raw = e.components.get('name') ?? 'thing';
  const noun = e.components.has('health') ? raw : raw.toLowerCase(); // creatures keep their name's case
  const openable = e.components.get('openable');
  return withArticle(openable ? `${openable.isOpen ? 'open' : 'closed'} ${noun}` : noun);
}

function terrainPhrase(tileId) {
  if (!tileId) return 'nothing';
  let name;
  try {
    name = getTileType(tileId).name.toLowerCase();
  } catch {
    return 'nothing';
  }
  return name === 'floor' ? 'the floor' : withArticle(name);
}

/**
 * Returns the player-facing "look at" sentence for `tile` from `viewer`'s perspective, tiered by
 * fog-of-war (visible / remembered / unseen). See the file overview.
 */
export function describeTile(level, viewer, tile) {
  const { x, y } = tile;
  const key = `${x},${y}`;
  const tp = viewer?.components.get('tilePerception');
  const visible = !tp || tp.visible.has(key);
  const remembered = tp && !visible && tp.memory.has(key);

  const pos = viewer?.components.get('position');
  const isSelf = pos && pos.x === x && pos.y === y;

  const occupants = [...level.getEntitiesAt(x, y)]
    .filter((e) => e.id !== viewer?.id && e.components.has('name'))
    .sort((a, b) => rank(a) - rank(b));

  if (visible) {
    const phrases = occupants.map(entityPhrase);
    if (phrases.length === 0) {
      return isSelf ? 'You are standing here.' : `You see ${terrainPhrase(level.getTile(x, y))}.`;
    }
    return `You see ${joinList(phrases)}.`;
  }

  if (remembered) {
    const phrases = occupants.filter((e) => e.components.has('persistVisible')).map(entityPhrase);
    if (phrases.length === 0) phrases.push(terrainPhrase(tp.memory.get(key)));
    return `You remember ${joinList(phrases)} there.`;
  }

  return "You can't see there.";
}
