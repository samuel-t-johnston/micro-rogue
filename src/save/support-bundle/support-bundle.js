/**
 * @file Support bundle: a downloadable diagnostic snapshot for bug reports — the live save state,
 * the full event log, and device info, in one JSON file. Generated on demand (currently a
 * hidden '?' keypress during play; a menu entry is the eventual home).
 */
import { serializeGame, GAME_VERSION } from '../core/save-system.js';
import { gameLog } from '../../engine/log/game-log.js';

/** Bundle envelope version. Bumped if the bundle's own shape changes (independent of save/game version). */
export const SUPPORT_BUNDLE_VERSION = 1;

/**
 * Best-effort device/environment readout. Reads globals defensively so it can't throw in a headless
 * context (and degrades to nulls rather than failing the whole bundle).
 */
export function collectDeviceInfo() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const win = typeof window !== 'undefined' ? window : {};
  return {
    userAgent: nav.userAgent ?? null,
    language: nav.language ?? null,
    platform: nav.platform ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? null,
    devicePixelRatio: win.devicePixelRatio ?? null,
    viewport: { width: win.innerWidth ?? null, height: win.innerHeight ?? null },
    screen: win.screen
      ? { width: win.screen.width ?? null, height: win.screen.height ?? null }
      : null,
  };
}

/**
 * Assembles the bundle from the live game. Pure data in, JSON-safe data out — reuses serializeGame
 * for the save snapshot so the bundle and the savegame can never disagree.
 */
export function buildSupportBundle({
  registry,
  level,
  player,
  turnCount,
  currentNodeId,
  frozenLevels,
}) {
  return {
    bundleVersion: SUPPORT_BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    gameVersion: GAME_VERSION,
    device: collectDeviceInfo(),
    save: serializeGame({ registry, level, player, turnCount, currentNodeId, frozenLevels }),
    log: gameLog.getAll(),
  };
}

/**
 * Triggers a browser download of the bundle as pretty-printed JSON. DOM side effect; the colons in
 * the ISO timestamp are swapped out so the filename is valid on every platform.
 */
export function downloadSupportBundle(bundle) {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rogue-support-${bundle.generatedAt.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
