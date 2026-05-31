import TERRAIN from '../../data/tiles/terrain.js';

export function getTileType(id) {
  const tile = TERRAIN[id];
  if (!tile) throw new Error(`Unknown tile type: "${id}"`);
  return tile;
}
