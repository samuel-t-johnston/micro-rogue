export function createLevel() {
  return {
    width: 0,
    height: 0,
    tiles: [],          // tiles[y][x] — tile type id string
    overrides: new Map(), // "x,y" -> tile type id string
    blackboard: {},
    entities: [],

    getTile(x, y) {
      return this.overrides.get(`${x},${y}`) ?? this.tiles[y]?.[x] ?? null;
    },
  };
}
