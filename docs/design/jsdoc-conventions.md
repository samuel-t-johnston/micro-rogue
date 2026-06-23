# JSDoc Conventions
Purpose: How ROGµE documents code with JSDoc — what gets a comment, which tags earn their place, and why the bar is "explain what the code can't say itself" rather than "annotate everything."

This is a **docs-only** standard: JSDoc here is prose and descriptive types for humans, not machine-enforced types. We ship vanilla ES modules with no build step, so nothing compiles these comments. They are written, however, with valid type syntax so that turning on editor type-checking later is a clean flip, not a rewrite (see [Future: enabling type-checking](#future-enabling-type-checking)).

## Principles

1. **Comment the *why*, not the *what*.** The signature already says what the parameters are. A good comment explains intent, constraints, units, side effects, ordering requirements, and the non-obvious reason the code is shaped the way it is. If a comment only restates the code, delete it. (AGENTS.md: "Do not include comments where code is straightforward, short, and/or self-documenting.")
2. **Extension contracts are first-class.** ROGµE is an extensible engine — devs swap whole systems (a pathfinder, a sense, a goal). The seams between systems are exactly what a third-party dev codes against, so the shape a goal/sense/action/effect must satisfy gets documented deliberately. A documented seam makes a system *easier* to replace, not harder.
3. **The ECS stays intentionally open.** Entities are `{ id, components: Map }` with heterogeneous, duck-typed component data so new component types need no central registration. We do **not** lock this down with closed types. Document individual component *shapes* with `@typedef` where it aids comprehension, but never force a global union.
4. **Tags are optional and earn their place.** A description block is required on every export; individual `@param`/`@returns` tags are added by judgment, using the heuristics below. "Optional" does not mean "random" — the heuristics tell you when a tag carries real information.

## What gets documented

| Code element | Expectation |
|---|---|
| **Module / file** | A `/** */` block at the top of the file when its purpose isn't obvious from its name and exports. State the role and any cross-cutting invariant. Link to a design doc with `@see` or a plain `docs/design/...` reference when one exists. Skip for trivial barrel/re-export files. **Keep a blank line between the module block and the first code** — without it, TypeScript/IDEs may attach the file overview to the first declaration instead of treating it as module-level. Tagging it `@file` makes that intent explicit. (Note: the strong hover/IntelliSense benefit of `/** */` is on *symbols*; module-level mostly buys consistency.) |
| **Exported functions & factories** | A `/** */` block on **every** export — one line is enough for a simple one. The public surface is documented uniformly so there's no per-symbol "is this trivial?" judgment (and so `require-jsdoc` can enforce it; a `//` comment does not satisfy that rule). Most of the engine is **factory functions** that return an object of closures (`createEntityRegistry`, `createSmellSense`), not ES classes — document the factory the way you'd document a class: what it produces and the contract of the returned API. |
| **Classes** (where used) | A block above the class describing its role. Document constructor params on the constructor or the class block. |
| **Extension-point objects** | Goals, senses, actions, effects, etc. — document the object and the contract method(s) it must implement (`evaluate(context)`, the returned shape). These are the seams; be explicit. |
| **Internal (non-exported) functions** | Document when non-trivial. A one-line `//` comment explaining intent is often enough; reserve full blocks for genuinely involved helpers. |
| **Trivial one-liners (non-exported)** | Skip. `getName()`, thin pass-throughs, and self-evident *internal* helpers need no block. The exemption is for non-exports only — exported symbols always get at least a one-line block (see above). |

## Block structure

Lead with a concise summary sentence. Add a blank line before any tags. Keep it tight — the existing well-documented files (`rng.js`, `planning-context.js`) are the reference.

```js
/**
 * Folds a master seed and ordered integer parts into a derived stream seed.
 * Order matters: the same parts in a different order yield a different stream.
 */
export function deriveSeed(master, ...parts) { ... }
```

A short single-line block is fine and encouraged when one sentence covers it:

```js
/** FNV-1a hash of a string to a uint32 — folds stream names into seeds. */
export function hashName(str) { ... }
```

Multi-line prose without tags is also valid — `//` comments are the right tool for explaining the *why* inline, and the engine uses them heavily (see `action-move.js`). JSDoc `/** */` is for the contract summary that belongs *with the symbol*; `//` is for reasoning *within* the body.

## When a tag earns its place

Add `@param` / `@returns` only when the tag tells the reader something the signature does not. Add it when:

- The parameter is **optional** or has a **default**: `@param {number} [seed] - Random if omitted.`
- The type is **non-obvious** from the name: a param named `opts`, `ctx`, `data`, or anything polymorphic.
- There are **units, ranges, or constraints**: "milliseconds", "0–1 inclusive", "must be passable".
- The parameter is a **coordinate** — state the indexing/origin when not obvious (this engine uses 0-indexed tile coordinates, origin top-left).
- The **return semantics are surprising**: a boolean whose `true`/`false` meaning isn't obvious (`executeMove` returns `false` = turn consumed, `true` = free action — worth stating), or a return that can be `null`.
- The function **throws**: `@throws {RangeError} When the seed is negative.`

Skip the tag when the parameter name and the one-line description already make it obvious. Don't write `@param {string} name - the name`.

### Tag reference

| Tag | Use |
|---|---|
| `@param {type} name - desc` | Parameter. Optional: `[name]`; with default: `[name=value]`; rest: `{...type} parts`. |
| `@returns {type} desc` | Return value. Omit for `void`/obvious returns; include when semantics are non-obvious or nullable. |
| `@throws {Type} desc` | Errors thrown. |
| `@typedef {Object} Name` + `@property` | Define a reusable shape (a component, an extension-point context, a result object). Put it near where the shape originates. |
| `@callback Name` | Document a function-typed parameter (e.g. a goal's `evaluate`). |
| `@see` | Cross-reference a design doc or related symbol. |
| `@example` | Usage snippet — high value on public/extension-facing APIs, optional elsewhere. |
| `@deprecated` | Mark for removal, with the replacement. |

Avoid `@author`, `@version`, `@since`, `@file` — git already tracks that, and they rot.

## Type syntax (keep it valid)

Even though types aren't checked today, write them in valid TypeScript-flavored JSDoc syntax so the door to `// @ts-check` stays open:

- Primitives: `{string}`, `{number}`, `{boolean}`
- Arrays: `{number[]}`, `{Tile[]}`
- Unions / nullable: `{number | null}`, `{Tile | undefined}`
- Objects: prefer a named `@typedef` over inline `{Object.<string, number>}` for anything reused
- Functions: `{(context: PlanningContext) => GoalResult}`
- Maps/Sets: `{Map<string, Component>}`, `{Set<number>}`

## Documenting extension contracts

The highest-value docs in the engine. **Define each seam's shape once, in the seam's home file**, then let the many implementations carry a plain prose description. Defining the typedef per-implementation doesn't scale (13 goals would each redefine it) and invites drift.

Worked example — the AI goal seam. The contract lives where it's exercised (`goal-evaluator.js`):

```js
/**
 * @typedef {{ action: object }} GoalResult
 * A goal's decision for the turn. A goal returns `null` instead to fall through.
 */

/**
 * @typedef {Object} Goal
 * @property {(context: import('./planning-context.js').PlanningContext) => (GoalResult | null | Promise<GoalResult | null>)} evaluate
 *   Decides this turn: return a GoalResult to act, or null to fall through to the next goal.
 */
```

`PlanningContext` similarly lives once in `planning-context.js`. Each of the 13 goal files then just describes *itself* — no typedef, no cross-file `@type`:

```js
/** Minimal NPC goal: step to a random passable adjacent tile each turn. */
export const wanderAimlessly = {
  evaluate(context) { ... },
};
```

Notes:
- **Cross-file type references** use the `import('./other-file.js').TypeName` form (valid JSDoc, resolves under `@ts-check`, satisfies `no-undefined-types`). Use it only in the canonical contract files; don't sprinkle it across every implementation.
- Keeping the implementations prose-only keeps them readable and lint-clean while the one authoritative typedef documents what every `evaluate` receives and must return.

## Anti-patterns

- **Restating the signature.** `@param {string} name - the name`. Adds nothing.
- **Confidently-wrong inherited comments.** Much of the existing prose is unreviewed LLM output. When you touch a file, treat its comments as suspect: verify against the code, fix or delete what's wrong. A wrong comment is worse than none (AGENTS.md forbids leaving code/docs in a contradictory state).
- **Tag-stuffing trivial functions** to satisfy a rule that isn't there. The bar is "does it help the reader."
- **Closing over the ECS with rigid types.** Don't replace the open component map with a closed union.

---

## Adoption steps: when ESLint is added

ESLint is not yet in the project. When it is added, wire up JSDoc linting as follows. These rules enforce *presence and well-formedness* — matching the docs-only, tags-by-judgment stance — and deliberately do **not** require `@param`/`@returns` on every export.

1. **Install:**
   ```
   npm install -D eslint eslint-plugin-jsdoc
   ```

2. **Flat config** (`eslint.config.js`, ESM to match `"type": "module"`):
   ```js
   import jsdoc from 'eslint-plugin-jsdoc';

   export default [
     {
       files: ['src/**/*.js'],
       ignores: ['**/*.test.js'],
       plugins: { jsdoc },
       rules: {
         // Require a block on exported functions/classes; not on trivial internals.
         'jsdoc/require-jsdoc': ['warn', {
           publicOnly: true,
           require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: false },
           // Factory functions are exported function declarations — covered above.
         }],
         // If a block exists, keep it well-formed and consistent with the code:
         'jsdoc/check-param-names': 'error',   // documented params must match the signature
         'jsdoc/check-types': 'error',         // valid type syntax (keeps us ts-check-ready)
         'jsdoc/check-tag-names': 'error',     // no invented tags
         'jsdoc/no-undefined-types': 'warn',   // @typedef names must resolve
         'jsdoc/require-param-description': 'warn',
         'jsdoc/require-returns-description': 'warn',
         // Intentionally OFF — tags are by judgment, not mandatory:
         'jsdoc/require-param': 'off',
         'jsdoc/require-returns': 'off',
       },
     },
   ];
   ```

3. **Add a script** to `package.json`:
   ```json
   "lint": "eslint .",
   "lint:fix": "eslint . --fix"
   ```

4. **Sequence the rollout:**
   - Land this convention doc first (done).
   - Run the backfill sweep (audit + fix existing comments, directory by directory) against this standard.
   - Add ESLint with `require-jsdoc` at **`warn`** while the backfill is in progress, so legacy gaps don't block work.
   - Once backfill is complete, flip `require-jsdoc` (and the `warn`-level rules) to **`error`** so regressions fail the lint.
   - Add `npm run lint` to whatever pre-commit / CI checks exist at that point.

## Future: enabling type-checking

Optional later phase, deliberately deferred. Because we write valid type syntax now, turning on editor/CI type-checking is incremental:

1. Add a `jsconfig.json` with `"checkJs": true` and `"strict"` scoped to start (e.g. only `src/engine/**` — the pure-logic cores: `rng`, `geometry`, `path-finder`, `fov`, where inference pays off most).
2. Add `// @ts-check` to individual files as they're brought up to clean, or rely on `checkJs` globally and silence noisy files by omission.
3. Run `npx tsc --noEmit` in CI. No emit, no build — type-checking only; the shipped JS is unchanged.

Keep the dynamic ECS plumbing out of strict checking, or `@typedef` its component shapes incrementally. The engine ships as vanilla ESM regardless — `// @ts-check` is an advisory editor tool, not a compile step.
