export const gameConfig = {
  tileSize: 32,
  // Set false before shipping to players — disables all debug tooling at zero runtime cost.
  debugEnabled: true,
  // New-game RNG seed. null → a fresh random seed per run (the normal case). Set to a number
  // to force a reproducible run while debugging. Loaded games ignore this and restore their own
  // saved seed + RNG state.
  seed: null,
};
