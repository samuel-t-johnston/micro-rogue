# Overview
Micro-Rogue (stylized ROGµE) is a game engine for traditional roguelike games written in vanilla client-side Javascript and HTML.

# Primary Directive

If you find contradictory information in your context, explain the contradiction and the sources, then request guidance. Do not leave code and/or documentation in a contradictory state - clean it up before proceeding. Do not arbitrarily pick an option if the correct action is not clear.

- Practice TDD where applicable (see Testing section).
- After you write code, review it for clarity, simplicity, and de-duplication.
- When code is written, tested and reviewed, consider updating documentation like MD files.

# Q&A

When presenting lists, questions, or any information with section headings where you expect me to respond, number those headings. This makes it easier for us to have a dialogue by referencing those numbers.

# Code Style
 - Use modern Javascript with modules and classes.
 - ES modules only, no CommonJS, no bundler.
 - Use JS Doc-style comments where applicable. Comments should be concise and make the code easier to read. Do not include comments where code is straightforward, short, and/or self-documenting via function and parameter names.
 - All random calls go through the shared seeded RNG - `rng.js`. `Math.random()` is forbidden in source and tests.
 - Use `new URL(relativePath, import.meta.url).href` for all asset and data file paths loaded at runtime in ES modules (sprite sheets, dynamically imported map files, etc.). Absolute paths like `/assets/...` resolve to the domain root, which breaks when the game is served from a subdirectory (e.g. GitHub Pages at `github.io/repo-name/`). If you know with certainty the game will always be served from the domain root or via a bundler that rewrites imports, this isn't required — but the `import.meta.url` pattern works in all cases and costs nothing.

# Dev Environment

Node.js is a dev-time dependency only — the shipped game is browser-only with no bundler.

Setup:

```
npm install
```

## Build Instructions

No build step. Source files are served directly to the browser as ES modules. To deploy, copy the repo contents (excluding `node_modules/`) to any static host.

## Run Instructions

Local dev (live-server on `http://127.0.0.1:8000` with auto-reload):

```
npm run dev
```

Kill dev server:

```
npm dev:kill
```

Kill any running instances and start server:

```
npm dev:fresh
```

The dev server serves the repo root, so `index.html` at the root, `src/` modules, and `styles/` all resolve via relative paths. Any static server pointed at the repo root works (e.g. `npx serve .`).

# Testing

## Framework

Vitest with `happy-dom` for tests that need a DOM. Test files live alongside source as `*.test.js`.
Run tests with `npm test` (watch mode) or `npm run test:run` (single pass).

## When to write tests first

Test-first (red → green → refactor) for:

- Pure logic with clear inputs and outputs
- Anything that consumes a seed or RNG state — determinism is the assertion
- Save migrations — every migration ships with a fixture file (a realsave at the source version) and a test that loads it and verifies the post-migration shape
- Pipeline stages (map generation) — each stage has defined inputs and outputs; that's the test
- Component behavior

## When not to write tests first

Test-after or not at all:

- Canvas rendering — visual inspection is the right tool
- Touch gesture detection and timing
- Animation feel (slide duration, wiggle amplitude, fade curves)
- Layout decisions and anchor positioning
- Anything where the spec is "looks right" or "feels right"

If you find yourself reaching for snapshot tests, stop. Assert the
specific properties that matter; snapshot diffs become unmaintainable
noise and train you to dismiss them.

Explicitly call out new functionality that is not unit tested.

DO NOT INSTALL TOOLS LIKE PLAYWRIGHT TO TEST UI!

## Workflow rules

- Write one failing test. Run it. Confirm it fails for the expected reason — a test that fails for the wrong reason is not a passing test, it's a bug you haven't found yet.
- Make it pass with the minimal change. Resist generalizing ahead of the next test.
- If a change breaks previously-passing tests and can't be fixed in one or two attempts, revert to the last green state. Do not stack attempts on a broken tree — broken intermediate states in context degrade subsequent work.
- One concept per test. A test called "movement works" that asserts seven things fails to communicate which one broke.
- Test names describe behavior, not implementation. "rejects movement into a wall" is good. "calls isPassable" is not.
- Don't test private implementation details. If a test breaks during a refactor that didn't change observable behavior, the test was wrong. 

# PRs
 - Code changes should be reviewed and unit tested before creating a PR.

# Documentation
- `README.md` provides the high-level overview for humans, and general goals for the project.
- `docs/howto` contains quick guides for common tasks, for humans and AIs. Whenever code is changed, consider whether a new "how-to" file would be helpful or an existing one should be updated.
- `docs/design` contains design and architecture documents for different aspects of the game engine.
- `docs/design/architecture-decision-records` contains ADRs for the project.