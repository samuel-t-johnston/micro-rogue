// Shared loader for static map layouts. Imports a map module by name and parses its `tiles`/`legend`
// into the level's tile grid, returning its authored `entities` list (instantiated later by the
// place-static-entities stage). Used by both the `static` and `randomStatic` structure stages.
// See docs/howto/static-map-layouts.md.

// Default module importer: resolves the map file relative to this module's URL (GitHub Pages-safe).
// Injectable so callers (tests, alternate sources) can supply modules without the dynamic import.
function importMapModule(layoutName) {
  const url = new URL(`../../../data/maps/${layoutName}.js`, import.meta.url);
  return import(url.href);
}

export async function loadStaticLayout(layoutName, level, importLayout = importMapModule) {
  return parseLayout(await importLayout(layoutName), layoutName, level);
}

// Pure parse: validates the tile string and writes it into the level. Returns the layout's entities.
export function parseLayout(mod, layoutName, level) {
  const rows = mod.tiles.trim().split('\n');
  if (rows.length === 0) throw new Error(`Map "${layoutName}" is empty`);
  const width = rows[0].length;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== width) {
      throw new Error(`Map "${layoutName}" has inconsistent row lengths (row 0: ${width}, row ${i}: ${rows[i].length})`);
    }
  }
  level.height = rows.length;
  level.width = width;
  level.tiles = rows.map(row =>
    [...row].map(char => {
      const tileId = mod.legend[char];
      if (!tileId) throw new Error(`Unknown symbol "${char}" in map "${layoutName}"`);
      return tileId;
    })
  );
  return mod.entities ?? [];
}
