import { describe, it, expect } from 'vitest';
import { resolveDestination, getNode, getStart } from './transit-map.js';
import transitMap from '../../../data/transit-map.js';

describe('transit map (the shipped 3-floor stack)', () => {
  it('starts on floor-1 at the up port', () => {
    expect(getStart(transitMap)).toEqual({ node: 'floor-1', port: 'up' });
  });

  it('resolves descents down the stack', () => {
    expect(resolveDestination(transitMap, 'floor-1', 'down')).toEqual({
      node: 'floor-2',
      port: 'up',
    });
    expect(resolveDestination(transitMap, 'floor-2', 'down')).toEqual({
      node: 'floor-3',
      port: 'up',
    });
  });

  it('resolves ascents (bidirectional edges traverse both ways)', () => {
    expect(resolveDestination(transitMap, 'floor-2', 'up')).toEqual({
      node: 'floor-1',
      port: 'down',
    });
    expect(resolveDestination(transitMap, 'floor-3', 'up')).toEqual({
      node: 'floor-2',
      port: 'down',
    });
  });

  it('returns null for unconnected ports (the stack ends)', () => {
    expect(resolveDestination(transitMap, 'floor-1', 'up')).toBeNull(); // top of the dungeon
    expect(resolveDestination(transitMap, 'floor-3', 'down')).toBeNull(); // bottom of the dungeon
  });

  it('wires floor-1 second down-stair to the BSP branch and back', () => {
    expect(getNode(transitMap, 'branch-1-floor-1')).toMatchObject({
      pipelineId: 'bsp',
      branch: 1,
      depth: 0,
    });
    expect(resolveDestination(transitMap, 'floor-1', 'branch1')).toEqual({
      node: 'branch-1-floor-1',
      port: 'up',
    });
    expect(resolveDestination(transitMap, 'branch-1-floor-1', 'up')).toEqual({
      node: 'floor-1',
      port: 'branch1',
    });
  });

  it('looks up nodes by id and their generation identity', () => {
    expect(getNode(transitMap, 'floor-2')).toMatchObject({
      id: 'floor-2',
      pipelineId: 'random-static-maze',
      branch: 0,
      depth: 1,
    });
    expect(getNode(transitMap, 'no-such-floor')).toBeNull();
  });
});

describe('resolveDestination — directionality', () => {
  const map = {
    nodes: [{ id: 'a' }, { id: 'b' }],
    edges: [
      { a: ['a', 'down'], b: ['b', 'up'], dir: 'bidi' },
      { a: ['a', 'pit'], b: ['b', 'landing'], dir: 'uni' },
    ],
  };

  it('traverses a uni edge only from its source', () => {
    expect(resolveDestination(map, 'a', 'pit')).toEqual({ node: 'b', port: 'landing' });
    expect(resolveDestination(map, 'b', 'landing')).toBeNull(); // no way back up the pit
  });
});
