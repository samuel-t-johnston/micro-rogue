/**
 * @file The blackboard keys the generation stages write and read. Stages communicate through the
 * level blackboard by string key; importing these constants instead of typing the literals makes a
 * typo a missing-import / reference error rather than a silent empty read (a producer writes one key,
 * a consumer reads a mistyped one and gets undefined). Named exports on purpose — a namespaced
 * `KEYS.grdi` would itself return undefined and reintroduce the silent read.
 *
 *   level:*  — the room-grid planning graph (geometry → label → link → carve → populate).
 *   static:* — the static/random-static structure stages (a hand-authored or picked layout).
 */
export const LEVEL_GRID = 'level:grid'; // { cols, rows, cellSize }
export const LEVEL_ZONES = 'level:zones'; // [{ id, cells, rect, labels }]
export const LEVEL_ADJACENCY = 'level:adjacency'; // [[idA, idB], …] (idA < idB, deduped)
export const LEVEL_LINKS = 'level:links'; // adjacency pairs chosen to become corridors
export const LEVEL_ROOMS = 'level:rooms'; // zone id -> carved room rect/tiles
export const STATIC_ENTITIES = 'static:entities'; // authored entity specs from a static layout
export const STATIC_LAYOUT = 'static:layout'; // the resolved static layout module/name
