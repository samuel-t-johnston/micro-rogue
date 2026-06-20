import { describe, it, expect } from 'vitest';
import { createHearingSense } from './hearing.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createLevel } from '../../world/level.js';
import { components } from '../../world/components.js';
import { emitSound } from '../../world/sounds.js';

const hearing = createHearingSense();

function setup({ range = 5, knownLanguages = [] } = {}) {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.width = 30;
  level.height = 30;
  level.tiles = Array.from({ length: 30 }, () => Array(30).fill('floor'));

  const hearer = registry.createEntity();
  registry.addComponent(hearer, 'position', components.position(10, 10));
  registry.addComponent(hearer, 'hearing', components.hearing(range));
  registry.addComponent(hearer, 'knownLanguages', components.knownLanguages(knownLanguages));
  level.placeEntity(hearer);

  return { registry, level, hearer };
}

describe('hearing sense', () => {
  it('reports a sound within range + volume, with a compass direction and the message', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    // 4 tiles east, volume 0 → within range 5.
    const sound = emitSound(registry, level, {
      sourceId: 99, x: 14, y: 10, volume: 0, language: null,
      message: { kind: 'enemy-report', direction: 'NW' },
    });

    const { sounds } = hearing(hearer, level, 7);
    expect(sounds).toHaveLength(1);
    expect(sounds[0]).toMatchObject({
      soundId: sound.id,
      position: { x: 14, y: 10 },
      sourceId: 99,
      message: { kind: 'enemy-report', direction: 'NW' },
      perceivedDirection: 'E',
      turnObserved: 7,
    });
  });

  it('does not report a sound beyond range + volume', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    // 8 tiles east, volume 2 → reach 7 < 8.
    emitSound(registry, level, { sourceId: 99, x: 18, y: 10, volume: 2 });
    expect(hearing(hearer, level, 0).sounds).toHaveLength(0);
  });

  it('extends audibility by the sound\'s volume', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    // 8 tiles east, volume 3 → reach 8 == distance 8 → audible.
    emitSound(registry, level, { sourceId: 99, x: 18, y: 10, volume: 3 });
    expect(hearing(hearer, level, 0).sounds).toHaveLength(1);
  });

  it('never reports the hearer\'s own sounds', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    emitSound(registry, level, { sourceId: hearer.id, x: 11, y: 10, volume: 0 });
    expect(hearing(hearer, level, 0).sounds).toHaveLength(0);
  });

  it('marks a vocalization understood only when the hearer knows its language', () => {
    const { registry, level, hearer } = setup({ range: 5, knownLanguages: ['orcish'] });
    emitSound(registry, level, { sourceId: 91, x: 12, y: 10, volume: 0, language: 'orcish' });
    emitSound(registry, level, { sourceId: 92, x: 8, y: 10, volume: 0, language: 'elvish' });
    const bySource = Object.fromEntries(hearing(hearer, level, 0).sounds.map(s => [s.sourceId, s.understood]));
    expect(bySource[91]).toBe(true);   // orcish — known
    expect(bySource[92]).toBe(false);  // elvish — unknown
  });

  it('passes the sound\'s source factions through to the percept', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    emitSound(registry, level, { sourceId: 91, x: 12, y: 10, volume: 0, sourceFactions: ['orcs'] });
    expect(hearing(hearer, level, 0).sounds[0].sourceFactions).toEqual(['orcs']);
  });

  it('treats a non-verbal sound (no language) as understood', () => {
    const { registry, level, hearer } = setup({ range: 5, knownLanguages: [] });
    emitSound(registry, level, { sourceId: 91, x: 12, y: 10, volume: 0, language: null });
    expect(hearing(hearer, level, 0).sounds[0].understood).toBe(true);
  });

  it('reports no entities and no visible tiles (it is not a sight sense)', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    emitSound(registry, level, { sourceId: 99, x: 12, y: 10, volume: 0 });
    const result = hearing(hearer, level, 0);
    expect(result.entities).toEqual([]);
    expect(result.visibleTiles.size).toBe(0);
  });

  it('hears nothing without a hearing component (deaf)', () => {
    const { registry, level, hearer } = setup({ range: 5 });
    hearer.components.delete('hearing');
    emitSound(registry, level, { sourceId: 99, x: 11, y: 10, volume: 0 });
    expect(hearing(hearer, level, 0).sounds).toHaveLength(0);
  });
});
