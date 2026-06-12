// The game's single animation sink. Animations are purely cosmetic: game state
// resolves immediately (an entity's `position` is the destination the instant it
// moves), and the animation layer just makes the sprite *chase* that already-settled
// truth. Nothing in the turn loop ever awaits an animation — this module is a leaf
// that depends on nothing and that nothing depends on, which is what keeps it from
// sprouting tendrils across the codebase (see docs/design/ux-design.md "Animations").
//
// Like `gameLog` and `rng`, it's an ambient singleton: producers (move/attack actions,
// the death chokepoint, future spells) fire-and-forget from wherever they resolve, and
// the renderer is the one consumer that reads the resulting transforms.
//
// Two flavours of animation:
//   - Attached: modify how an existing entity is drawn (slide offset, attack lunge).
//     Keyed by entity id; the normal entity pass still draws the sprite, transformed.
//   - Detached: own their visual (a snapshot of sprite + position) and draw in a
//     separate pass. Needed when there's no live entity to attach to — death smoosh
//     (the entity is removed before it could animate), and projectiles later.

// Motion durations (ms). Movement slide is kept short (ux-design: 80–120ms) so turn
// pace never reads as sluggish; the others are tuned for "feel" and easily nudged.
const SLIDE_MS = 110;
const WIGGLE_MS = 150;
const SMOOSH_MS = 260;

// How far an attack lunge displaces the attacker toward its target, in tiles.
const WIGGLE_AMP = 0.35;

const now = () => performance.now();

// Easing helpers. `t` is normalised progress in [0, 1].
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const linear = (t) => t;

// A transform contribution. dx/dy are in tile units (renderer multiplies by tileSize);
// scale/alpha multiply. `anchor` controls the scale pivot ('center' or 'bottom').
function identityTransform() {
  return { dx: 0, dy: 0, scaleX: 1, scaleY: 1, alpha: 1, anchor: 'center' };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function createAnimationManager() {
  let active = [];     // all in-flight animations, attached and detached
  let current = 0;     // last frame timestamp; getters sample against this
  let enabled = true;  // reduced-motion / "disable animations" kill switch

  // Progress of an animation at the current frame time, clamped to [0, 1].
  function progress(anim) {
    return clamp01((current - anim.start) / anim.duration);
  }

  // Compose every attached animation for one entity into a single transform.
  // Offsets sum; scale and alpha multiply. Returns null when nothing is animating
  // the entity, so the renderer can take its plain fast path.
  function transformFor(entityId) {
    let out = null;
    for (const anim of active) {
      if (anim.entityId !== entityId) continue;
      const s = anim.sample(anim.ease(progress(anim)));
      if (!out) out = identityTransform();
      out.dx += s.dx ?? 0;
      out.dy += s.dy ?? 0;
      out.scaleX *= s.scaleX ?? 1;
      out.scaleY *= s.scaleY ?? 1;
      out.alpha *= s.alpha ?? 1;
      if (s.anchor) out.anchor = s.anchor;
    }
    return out;
  }

  // The entity's on-screen tile position: logical position plus any attached offset.
  // The camera follows this (not the logical position) so the viewport tracks the
  // sliding sprite rather than snapping ahead of it.
  function visualPos(entity) {
    const pos = entity.components.get('position');
    if (!pos) return { x: 0, y: 0 };
    const t = transformFor(entity.id);
    return { x: pos.x + (t?.dx ?? 0), y: pos.y + (t?.dy ?? 0) };
  }

  // Detached animations carry their own renderable snapshot + position; the renderer
  // samples each one's transform directly when drawing them.
  function detached() {
    return active.filter((a) => a.entityId === null);
  }

  function add(anim) {
    active.push({ start: now(), ...anim });
  }

  // Advance the clock and drop finished animations. Called once per render frame
  // before anything is drawn, so every sample within a frame shares one timestamp.
  function frame(t = now()) {
    current = t;
    if (active.length === 0) return;
    active = active.filter((a) => current - a.start < a.duration);
  }

  return {
    transformFor,
    visualPos,
    detached,
    frame,

    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },

    // Attached: slide a sprite from its previous tile to its (already-updated) logical
    // tile. Modelled as an offset that decays to zero, so rapid moves chain cleanly —
    // the new slide picks up the sprite's current visual offset and re-eases to zero,
    // keeping the sprite continuous instead of snapping between taps.
    slide(entity, from, to, opts = {}) {
      if (!enabled || !from || !to) return;
      const existing = transformFor(entity.id);
      const startOffset = {
        x: (from.x - to.x) + (existing?.dx ?? 0),
        y: (from.y - to.y) + (existing?.dy ?? 0),
      };
      if (startOffset.x === 0 && startOffset.y === 0) return;
      add({
        entityId: entity.id,
        kind: 'slide',
        duration: opts.duration ?? SLIDE_MS,
        ease: easeOutCubic,
        sample: (e) => ({ dx: startOffset.x * (1 - e), dy: startOffset.y * (1 - e) }),
      });
    },

    // Attached: a quick lunge toward a target tile and back (melee attacks, bumps).
    // Independent of whether the target survives — it's the attacker that moves.
    wiggle(entity, target, opts = {}) {
      if (!enabled) return;
      const pos = entity.components.get('position');
      if (!pos || !target) return;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const len = Math.hypot(dx, dy) || 1;
      const amp = opts.amplitude ?? WIGGLE_AMP;
      const ux = (dx / len) * amp;
      const uy = (dy / len) * amp;
      add({
        entityId: entity.id,
        kind: 'wiggle',
        duration: opts.duration ?? WIGGLE_MS,
        ease: linear,
        // sin(πp) rises to the peak at the halfway point and returns to zero.
        sample: (p) => {
          const k = Math.sin(p * Math.PI);
          return { dx: ux * k, dy: uy * k };
        },
      });
    },

    // Detached: squash a dying entity flat onto the floor and fade it out. Snapshots
    // the renderable now, before the caller removes the entity from the world, so the
    // smoosh keeps drawing after the entity is gone.
    smoosh(entity, opts = {}) {
      if (!enabled) return;
      const pos = entity.components.get('position');
      const r = entity.components.get('renderable');
      if (!pos || !r) return;
      add({
        entityId: null,
        kind: 'smoosh',
        x: pos.x,
        y: pos.y,
        renderable: { sprite: r.sprite, color: r.color, glyph: r.glyph, glyphColor: r.glyphColor },
        duration: opts.duration ?? SMOOSH_MS,
        ease: easeOutQuad,
        sample: (e) => ({ scaleX: 1 + 0.3 * e, scaleY: 1 - 0.85 * e, alpha: 1 - e, anchor: 'bottom' }),
      });
    },

    // Generic escape hatch for one-off or future motions (projectiles, floating
    // numbers). `spec` is added verbatim; supply at minimum { entityId, duration,
    // ease, sample } for attached, plus { x, y, renderable } for detached.
    play(spec) {
      if (!enabled) return;
      add(spec);
    },

    // Drop all in-flight animations. Called on new-game and scene teardown so a fresh
    // run never inherits a stale slide from the previous one.
    reset() {
      active = [];
      current = 0;
      enabled = true;
    },

    // Sampled transform for a detached animation at the current frame (renderer use).
    sampleDetached(anim) {
      const base = identityTransform();
      const s = anim.sample(anim.ease(progress(anim)));
      return { ...base, ...s };
    },
  };
}

export const animations = createAnimationManager();
