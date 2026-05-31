export async function run(level, stageConfig, _blackboard, _rng) {
  const mod = await import(`/data/maps/${stageConfig.layout}.js`);
  const rows = mod.tiles.trim().split('\n');
  if (rows.length === 0) throw new Error(`Map "${stageConfig.layout}" is empty`);
  const width = rows[0].length;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== width) {
      throw new Error(`Map "${stageConfig.layout}" has inconsistent row lengths (row 0: ${width}, row ${i}: ${rows[i].length})`);
    }
  }
  level.height = rows.length;
  level.width = width;
  level.tiles = rows.map(row =>
    [...row].map(char => {
      const tileId = mod.legend[char];
      if (!tileId) throw new Error(`Unknown symbol "${char}" in map "${stageConfig.layout}"`);
      return tileId;
    })
  );
}
