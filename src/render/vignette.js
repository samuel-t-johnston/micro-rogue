/**
 * @file Vignette: transient full-screen edge glows — a colored gradient hugging the screen border that
 * fades to clear at the center, used for cosmetic emphasis (a gold swell on level-up) and, later, urgent
 * warnings that must read even over an open menu (a red damage "heartbeat"). Ambient singleton in the
 * spirit of `animations` and `gameLog`: producers fire-and-forget via `trigger`, and the one consumer
 * (game-scene, drawing last so the overlay sits above the UI) calls `render`.
 *
 * A vignette is described by three knobs — `color`, `pulses`, and `pulseLength` (ms per pulse) — plus an
 * optional `maxAlpha` peak. Its life is `pulses × pulseLength` ms, split into that many back-to-back
 * bumps, each a quick rise to peak and a slow fade. Kept separate from `animations.js`, which is about
 * entity/tile motion (per-sprite transforms), because this is a screen-space effect with no world
 * position; it does, however, honor the same reduced-motion kill switch. See docs/design/ux-design.md.
 */
import { animations } from './animations.js';

const now = () => performance.now();

const DEFAULT_MAX_ALPHA = 0.55;
const RISE = 0.2; // fraction of a pulse spent rising to the peak; the remaining 0.8 is the slow fade
const INNER_RADIUS = 0.75; // fraction of the corner distance kept fully clear — a thin edge band

const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeInQuad = (t) => t * t;

// One pulse's shape over its normalized phase [0, 1): a quick ease up to full at RISE, then a long ease
// back to zero — so a lone long pulse reads as "pop in, fade out slowly" and a short one as a sharp beat.
function pulseEnvelope(phase) {
  if (phase < RISE) return easeOutQuad(phase / RISE);
  return 1 - easeInQuad((phase - RISE) / (1 - RISE));
}

/**
 * The alpha of a vignette `elapsed` ms after it started: 0 before it begins and once its full
 * `pulses × pulseLength` run is over; in between, `elapsed` is split into `pulses` bumps of `pulseLength`
 * ms, each scaled to `maxAlpha`. Pure and deterministic — the timed core, unit-tested apart from canvas.
 */
export function vignetteAlpha(elapsed, { pulses, pulseLength, maxAlpha = DEFAULT_MAX_ALPHA }) {
  const total = pulses * pulseLength;
  if (elapsed <= 0 || elapsed >= total) return 0;
  const phase = (elapsed % pulseLength) / pulseLength;
  return maxAlpha * pulseEnvelope(phase);
}

// "#rrggbb" + alpha → an "rgba(r,g,b,a)" string. Keeping the gradient's stops on one RGB (varying only
// alpha) avoids the muddy mid-fade you'd get interpolating an opaque color against `transparent`.
function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Paints one edge vignette: `color` at `alpha` around the border, fading to fully transparent by
 * `INNER_RADIUS` of the way out, so it frames the view without covering its center. A no-op at alpha ≤ 0.
 */
export function drawVignette(ctx, width, height, { color, alpha }) {
  if (alpha <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy); // reach the corners
  const grad = ctx.createRadialGradient(cx, cy, outer * INNER_RADIUS, cx, cy, outer);
  grad.addColorStop(0, rgba(color, 0));
  grad.addColorStop(1, rgba(color, alpha));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function createVignetteManager() {
  let active = []; // transient pulses: { start, color, pulses, pulseLength, maxAlpha }
  const sustained = new Map(); // key -> { color, alpha }: steady overlays held while a state persists

  return {
    /**
     * Start a transient vignette. No-op when animations are disabled (reduced motion) or no color is
     * given, so callers can fire unconditionally. `pulses`/`pulseLength`/`maxAlpha` fall back to defaults.
     */
    trigger({ color, pulses = 1, pulseLength = 1000, maxAlpha = DEFAULT_MAX_ALPHA } = {}) {
      if (!animations.enabled || !color) return;
      active.push({ start: now(), color, pulses, pulseLength, maxAlpha });
    },

    /**
     * Set (or clear, with a nullish `spec`) a steady vignette held under `key` while some state lasts —
     * e.g. a thin red edge while starving. Unlike a pulse it doesn't time out; the caller sets it each
     * frame from the live state. Kept on regardless of the reduced-motion switch: it's a static tint (no
     * motion), which is exactly the accessible fallback form. `spec` is `{ color, alpha }`.
     */
    setSustained(key, spec) {
      if (spec) sustained.set(key, spec);
      else sustained.delete(key);
    },

    // Draw the steady sustained overlays, then the transient pulses on top, dropping finished pulses.
    // Self-timed off performance.now() (a test may pass an explicit `t`); called last in the frame so
    // the overlay sits above the world and the UI.
    render(ctx, width, height, t = now()) {
      for (const spec of sustained.values()) drawVignette(ctx, width, height, spec);
      if (active.length === 0) return;
      const still = [];
      for (const v of active) {
        const elapsed = t - v.start;
        if (elapsed >= v.pulses * v.pulseLength) continue; // finished
        drawVignette(ctx, width, height, { color: v.color, alpha: vignetteAlpha(elapsed, v) });
        still.push(v);
      }
      active = still;
    },

    // Drop all vignettes, transient and sustained (new-game / scene teardown), mirroring animations.reset().
    reset() {
      active = [];
      sustained.clear();
    },
  };
}

/** The game's ambient vignette singleton (see the file overview). */
export const vignette = createVignetteManager();
