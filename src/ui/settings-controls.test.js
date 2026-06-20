import { describe, it, expect } from 'vitest';
import { layoutSettingsRows, handleSettingsRowsInput } from './settings-controls.js';

// Deterministic measuring so wrapText runs without a real canvas.
const fakeCtx = () => ({ font: '', measureText: (t) => ({ width: String(t).length * 8 }) });
const getViewport = () => ({ width: 800, height: 600 });

function makeRows() {
  const state = { handedness: 'right' };
  const rows = [{
    id: 'handedness', label: 'Handedness', description: 'Side of the action button.',
    options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }],
    get: () => state.handedness, set: (v) => { state.handedness = v; },
  }];
  return { rows, state };
}

describe('settings rows', () => {
  it('highlights the segment matching the current value', () => {
    const layout = layoutSettingsRows(fakeCtx(), getViewport, makeRows().rows);
    expect(layout[0].selectedIndex).toBe(1); // 'right' is the second option
  });

  it('tapping a segment calls set with that option value', () => {
    const { rows, state } = makeRows();
    const layout = layoutSettingsRows(fakeCtx(), getViewport, rows);
    const left = layout[0].segments[0];
    const handled = handleSettingsRowsInput(layout, {
      type: 'pointerdown', x: left.x + left.w / 2, y: left.y + left.h / 2,
    });
    expect(handled).toBe(true);
    expect(state.handedness).toBe('left');
  });

  it('ignores a pointerdown outside any segment', () => {
    const layout = layoutSettingsRows(fakeCtx(), getViewport, makeRows().rows);
    expect(handleSettingsRowsInput(layout, { type: 'pointerdown', x: 5, y: 5 })).toBe(false);
  });

  it('ignores non-pointerdown events', () => {
    const layout = layoutSettingsRows(fakeCtx(), getViewport, makeRows().rows);
    expect(handleSettingsRowsInput(layout, { type: 'pointermove', x: 0, y: 0 })).toBe(false);
  });
});
