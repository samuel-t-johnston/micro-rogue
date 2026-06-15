import { describe, it, expect } from 'vitest';
import { levelToAscii, zonesToText, zonesToMermaid } from './visualize.js';
import { createLevel } from '../level.js';

describe('levelToAscii', () => {
  it('renders tiles by symbol with entity glyphs overlaid', () => {
    const level = createLevel();
    level.width = 3;
    level.height = 3;
    level.tiles = [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'wall'],
      ['wall', 'wall', 'wall'],
    ];
    level.entities.push({
      components: new Map([['position', { x: 1, y: 1 }], ['renderable', { glyph: '@' }]]),
    });
    expect(levelToAscii(level)).toBe('###\n#@#\n###');
  });

  it('returns a placeholder before any tiles are carved', () => {
    expect(levelToAscii(createLevel())).toBe('(no tiles carved yet)');
  });
});

describe('zonesToText', () => {
  it('summarizes zones, links, and adjacency', () => {
    const text = zonesToText({
      'level:zones': [{ id: 0, cells: [[0, 0]], rect: { x: 0, y: 0, w: 10, h: 10 }, labels: ['room', 'stairs-up'] }],
      'level:links': [{ id: 0, a: 0, b: 1 }],
      'level:adjacency': [[0, 1]],
    });
    expect(text).toContain('Zones (1):');
    expect(text).toContain('0 [room, stairs-up]');
    expect(text).toContain('Links (1): 0-1');
    expect(text).toContain('Adjacency (1): 0-1');
  });
});

describe('zonesToMermaid', () => {
  it('emits a flowchart with solid links and dashed unlinked adjacency', () => {
    const mermaid = zonesToMermaid({
      'level:zones': [
        { id: 0, labels: ['room', 'stairs-up'] },
        { id: 1, labels: ['room'] },
        { id: 2, labels: ['room'] },
      ],
      'level:links': [{ id: 0, a: 0, b: 1 }],
      'level:adjacency': [[0, 1], [1, 2]],
    });
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('z0["0 · stairs-up"]');
    expect(mermaid).toContain('z0 --- z1');   // the link, solid
    expect(mermaid).toContain('z1 -.- z2');   // adjacency without a link, dashed
  });
});
