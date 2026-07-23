import { describe, it, expect } from 'vitest';
import {
  levelToAscii,
  zonesToText,
  zonesToMermaid,
  levelToHtml,
  mapLegendHtml,
} from './visualize.js';
import { createLevel } from '../map/level.js';
import { LEVEL_ZONES, LEVEL_ROOMS } from './blackboard-keys.js';

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
      components: new Map([
        ['position', { x: 1, y: 1 }],
        ['renderable', { glyph: '@' }],
      ]),
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
      'level:zones': [
        {
          id: 0,
          cells: [[0, 0]],
          rect: { x: 0, y: 0, w: 10, h: 10 },
          labels: ['room', 'stairs-up'],
        },
      ],
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
      'level:adjacency': [
        [0, 1],
        [1, 2],
      ],
    });
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('z0["0 · stairs-up"]');
    expect(mermaid).toContain('z0 --- z1'); // the link, solid
    expect(mermaid).toContain('z1 -.- z2'); // adjacency without a link, dashed
  });
});

// A tiny two-district fixture: a 6x3 level whose floor row holds a 'keep' chamber, a 'cave' chamber,
// and a passage, with a creature glyph on the keep tile. Decoupled from any shipped pipeline (see the
// tests-decoupled-from-content convention) — asserts the render contract, not a roster.
function fixtureLevel() {
  const level = createLevel();
  level.width = 6;
  level.height = 3;
  level.tiles = [
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'floor', 'floor', 'floor', 'floor', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ];
  level.blackboard[LEVEL_ZONES] = [
    { id: 0, cells: [[0, 0]], labels: ['room'], section: 'keep' },
    { id: 1, cells: [[1, 0]], labels: ['room'], section: 'cave' },
    { id: 2, cells: [[2, 0]], labels: ['passage'], kind: 'passage', section: 'cave' },
  ];
  level.blackboard[LEVEL_ROOMS] = {
    '0,0': { tiles: [[1, 1]] },
    '1,0': { tiles: [[3, 1]] },
    '2,0': { tiles: [[4, 1]] },
  };
  level.entities.push({
    components: new Map([
      ['position', { x: 1, y: 1 }],
      ['renderable', { glyph: 'o', glyphColor: '#f85149', layer: 5 }],
    ]),
  });
  return level;
}

describe('levelToHtml', () => {
  it('renders one cell per tile, tinting rooms by section and overlaying entity glyphs', () => {
    const html = levelToHtml(fixtureLevel());
    // 18 tiles → 18 cells.
    expect((html.match(/<i /g) ?? []).length).toBe(18);
    expect(html).toContain('<i class="s0" style="color:#f85149">o</i>'); // keep tile + the creature
    expect(html).toContain('<i class="s1">&nbsp;</i>'); // the cave chamber tile
    expect(html).toContain('<i class="p">&nbsp;</i>'); // the cave passage tile
    expect(html).toContain('<i class="w">&nbsp;</i>'); // a wall tile
  });

  it('returns a placeholder before any tiles are carved', () => {
    expect(levelToHtml(createLevel())).toContain('(no tiles carved yet)');
  });
});

describe('mapLegendHtml', () => {
  it('lists a swatch per district (matching the render) plus passage', () => {
    const legend = mapLegendHtml(fixtureLevel());
    expect(legend).toContain('<i class="s0"></i>keep');
    expect(legend).toContain('<i class="s1"></i>cave');
    expect(legend).toContain('<i class="p"></i>passage');
  });
});
