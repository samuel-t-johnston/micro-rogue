import { describe, it, expect } from 'vitest';
import {
  LogViewState,
  nextLogView,
  visibleLogLines,
  debugLogLines,
  formatDebugEntry,
  clampScroll,
} from './message-log.js';

describe('nextLogView', () => {
  it('opens from the ghost view to the expanded view', () => {
    expect(nextLogView(LogViewState.GHOST, false)).toBe(LogViewState.EXPANDED);
  });

  it('advances expanded to debug when debug is enabled', () => {
    expect(nextLogView(LogViewState.EXPANDED, true)).toBe(LogViewState.DEBUG);
  });

  it('closes expanded straight to ghost when debug is disabled', () => {
    expect(nextLogView(LogViewState.EXPANDED, false)).toBe(LogViewState.GHOST);
  });

  it('closes the debug view back to ghost', () => {
    expect(nextLogView(LogViewState.DEBUG, true)).toBe(LogViewState.GHOST);
  });
});

describe('visibleLogLines', () => {
  it('maps display strings to non-debug lines', () => {
    expect(visibleLogLines([{ display: 'You hit the orc.' }])).toEqual([
      { text: 'You hit the orc.', debug: false },
    ]);
  });
});

describe('debugLogLines', () => {
  it('flags entries with no display string as debug and wraps them in braces', () => {
    const [line] = debugLogLines([{ turn: 4, action: 'move', actor: 'player' }]);
    expect(line.debug).toBe(true);
    expect(line.text).toBe('{T4 action=move actor=player}');
  });

  it('flags unseen entries as debug even when they carry a display string', () => {
    const [line] = debugLogLines([{ turn: 4, display: 'A clash echoes.', seen: false }]);
    expect(line.debug).toBe(true);
    expect(line.text).toBe('{T4 A clash echoes.}');
  });

  it('treats seen player-facing entries as non-debug and leaves them unbraced', () => {
    const [line] = debugLogLines([{ turn: 4, display: 'You enter.', seen: true }]);
    expect(line.debug).toBe(false);
    expect(line.text).toBe('T4 You enter.');
  });

  it('treats entries with no seen flag as non-debug (default visible)', () => {
    const [line] = debugLogLines([{ turn: 4, display: 'You enter.' }]);
    expect(line.debug).toBe(false);
  });
});

describe('formatDebugEntry', () => {
  it('prefixes the turn and uses the display string when present', () => {
    expect(formatDebugEntry({ turn: 12, display: 'You enter.', seen: true })).toBe(
      'T12 You enter.',
    );
  });

  it('renders structured fields for entries with no display string', () => {
    expect(formatDebugEntry({ turn: 3, action: 'move', actor: 'goblin-2' })).toBe(
      'T3 action=move actor=goblin-2',
    );
  });

  it('skips the cross-cutting turn/seen fields in the structured rendering', () => {
    expect(formatDebugEntry({ turn: 7, seen: false, action: 'hear' })).toBe('T7 action=hear');
  });
});

describe('clampScroll', () => {
  it('pins to zero when the content fits the viewport', () => {
    expect(clampScroll(50, 100, 200)).toBe(0);
  });

  it('pins to the maximum offset past the bottom', () => {
    expect(clampScroll(999, 500, 200)).toBe(300);
  });

  it('passes a valid offset through unchanged', () => {
    expect(clampScroll(120, 500, 200)).toBe(120);
  });
});
