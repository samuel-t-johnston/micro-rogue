import { describe, it, expect } from 'vitest';
import * as creatures from './creatures.js';
import * as items from './items.js';
import * as furniture from './furniture.js';
import { ENTITY_PREFABS } from './entity-prefabs.js';

// Guards against the classic "added a factory, forgot the prefab" slip: every create* factory a
// content module exports must be reachable from ENTITY_PREFABS. By convention a factory createFooBar
// is registered under id 'fooBar'; factories reached only through wrapper prefabs (or under several
// ids) can't be matched by name, so they're listed in INDIRECT with the ids that cover them.
const INDIRECT = new Set([
  'createStairs', // -> 'stairsUp' / 'stairsDown'
]);

// 'createFooBar' -> 'fooBar' ('create' is 6 chars; lowercase the first letter of the remainder).
const prefabIdFor = (factoryName) => factoryName[6].toLowerCase() + factoryName.slice(7);

const factoryNames = [creatures, items, furniture].flatMap((module) =>
  Object.keys(module).filter((name) => name.startsWith('create')),
);

describe('entity prefab coverage', () => {
  for (const name of factoryNames) {
    it(`${name} is registered in ENTITY_PREFABS`, () => {
      if (INDIRECT.has(name)) return;
      const id = prefabIdFor(name);
      expect(
        ENTITY_PREFABS[id],
        `${name} has no prefab (expected id "${id}" in entity-prefabs.js, or add it to INDIRECT)`,
      ).toBeDefined();
    });
  }
});
