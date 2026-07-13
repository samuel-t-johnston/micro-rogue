import { describe, it, expect } from 'vitest';
import { createEventLog } from './event-log.js';

describe('createEventLog', () => {
  it('getAll returns every appended entry in order', () => {
    const log = createEventLog();
    log.add({ display: 'a' });
    log.add({ action: 'move' });
    expect(log.getAll().map((e) => e.display ?? e.action)).toEqual(['a', 'move']);
  });

  it('getDisplayEntries returns only entries with a display string', () => {
    const log = createEventLog();
    log.add({ display: 'shown' });
    log.add({ action: 'move' }); // no display → debug-only
    expect(log.getDisplayEntries(10).map((e) => e.display)).toEqual(['shown']);
  });

  it('hides entries marked unseen, but keeps seen:true and unclassified (undefined)', () => {
    const log = createEventLog();
    log.add({ display: 'seen', seen: true });
    log.add({ display: 'hidden', seen: false });
    log.add({ display: 'default' }); // seen undefined → shown
    expect(log.getDisplayEntries(10).map((e) => e.display)).toEqual(['seen', 'default']);
  });

  it('returns only the most-recent `count` display entries', () => {
    const log = createEventLog();
    for (const d of ['a', 'b', 'c', 'd']) log.add({ display: d });
    expect(log.getDisplayEntries(2).map((e) => e.display)).toEqual(['c', 'd']);
  });

  // B5 (ENGINE-1): count <= 0 must return no entries — slice(-0) === slice(0) would return them all.
  it('getDisplayEntries(0) returns no entries', () => {
    const log = createEventLog();
    log.add({ display: 'a' });
    log.add({ display: 'b' });
    expect(log.getDisplayEntries(0)).toEqual([]);
    expect(log.getDisplayEntries(-5)).toEqual([]);
  });

  it('getDisplayEntries(Infinity) returns the full display history', () => {
    const log = createEventLog();
    log.add({ display: 'a' });
    log.add({ action: 'move' });
    log.add({ display: 'b' });
    expect(log.getDisplayEntries(Infinity).map((e) => e.display)).toEqual(['a', 'b']);
  });

  it('reset clears all entries', () => {
    const log = createEventLog();
    log.add({ display: 'a' });
    log.reset();
    expect(log.getAll()).toEqual([]);
  });
});
