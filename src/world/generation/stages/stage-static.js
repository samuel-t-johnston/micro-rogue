export async function run(level, stageConfig, _blackboard, _rng) {
  const mod = await import(`/data/maps/${stageConfig.layout}.js`);
  const rows = mod.tiles.trim().split('\n');
  level.height = rows.length;
  level.width = rows[0].length;
  level.tiles = rows.map(row =>
    [...row].map(char => {
      const tileId = mod.legend[char];
      if (!tileId) throw new Error(`Unknown symbol "${char}" in map "${stageConfig.layout}"`);
      return tileId;
    })
  );
}
