import { describe, it, expect } from 'vitest';
import { createAnimationManager } from './animations.js';

describe('animation enable/disable seam', () => {
  it('defaults to enabled', () => {
    expect(createAnimationManager().enabled).toBe(true);
  });

  it('setEnabled toggles the kill switch', () => {
    const anims = createAnimationManager();
    anims.setEnabled(false);
    expect(anims.enabled).toBe(false);
  });

  it('preserves the enabled choice across reset (a reduced-motion setting persists)', () => {
    const anims = createAnimationManager();
    anims.setEnabled(false);
    anims.reset();
    expect(anims.enabled).toBe(false);
  });
});
