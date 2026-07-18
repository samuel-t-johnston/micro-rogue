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
// [{ id, cells, rect, labels, kind?, origin? }]. kind: 'chamber'|'passage'|'junction' (absent ⇒
// chamber); only chamber zones get labels/population. origin: 'tagged'|'inferred' — debug/visualizer
// only, no stage may branch on it. See docs/design/organic-map-generation.md (ADR-026).
export const LEVEL_ZONES = 'level:zones';
export const LEVEL_ADJACENCY = 'level:adjacency'; // [[idA, idB], …] (idA < idB, deduped)
export const LEVEL_LINKS = 'level:links'; // adjacency pairs chosen to become corridors
// Organic plan graph (no tiles yet): the chamber sites and the connections between them, consumed by
// the carve stages. See docs/design/organic-map-generation.md.
export const LEVEL_NODES = 'level:nodes'; // [{ id, x, y, radius }] — planned chamber sites
export const LEVEL_EDGES = 'level:edges'; // [{ a, b, kind }] — kind: 'mst' | 'loop'
// zone cell "c,r" -> carved room floor: a rect { x0,y0,x1,y1 } (BSP/grid/static) or an irregular
// tile set { tiles:[[x,y]…] } (organic); either may carry core:[x,y], a deep-interior anchor.
export const LEVEL_ROOMS = 'level:rooms';
export const LEVEL_BSP = 'level:bsp'; // BSP carve plan: { bounds, outerWall, exits: [{a,b,gap,orientation}] }
export const STATIC_ENTITIES = 'static:entities'; // authored entity specs from a static layout
export const STATIC_LAYOUT = 'static:layout'; // the resolved static layout module/name
