/**
 * @file The terrain palette: the { floor, wall } tile ids the carve stages lay down. Generation reads
 * and writes tiles by *category* (floor/wall), and the palette maps each category to a concrete tile id,
 * so the same carve stage produces stone or cave terrain depending only on the palette in scope. The
 * palette lives on the blackboard and is "sticky": the `palette` stage sets it and it holds until the
 * next `palette` stage, so a pipeline themes a run (or a section of one) by interleaving palette stages
 * rather than passing tile ids to every carve stage. Absent, generation falls back to plain stone.
 */
import { LEVEL_PALETTE } from './blackboard-keys.js';

/** The fallback palette when no `palette` stage has run: the original stone floor and wall. */
export const DEFAULT_PALETTE = { floor: 'floor', wall: 'wall' };

/** The palette currently in scope on the blackboard, or {@link DEFAULT_PALETTE} if none set. */
export function paletteOf(blackboard) {
  return blackboard?.[LEVEL_PALETTE] ?? DEFAULT_PALETTE;
}
