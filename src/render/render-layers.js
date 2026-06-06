// Z-order for entity rendering. Lower values draw first (underneath).
// Renderables without an explicit layer fall back to DEFAULT — items override to ITEM
// so a creature standing on a dropped item draws on top of it.
//
// Gaps in the numbering leave room to insert future tiers (e.g. BACKGROUND = 5 for
// blood/scorch decals, OVERLAY = 30 for emotes) without renumbering existing layers.
export const RenderLayers = Object.freeze({
  ITEM:    10,
  DEFAULT: 20,
});
