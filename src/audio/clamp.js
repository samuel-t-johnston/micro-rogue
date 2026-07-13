/**
 * Clamps a value into the [0, 1] volume range, coercing to a number and treating NaN as 0. The one
 * definition shared by the audio modules (audio-core / sfx / music), which all guard their gains this way.
 */
export function clamp01(v) {
  v = Number(v);
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
