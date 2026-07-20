# ROGµE

Micro-Rogue (stylized ROGµE) is a game engine for traditional roguelike games written in Javascript and HTML.

ROGμE is designed to be an easy way to jump into game development, even if you don't have any experience in games, software dev, or Javascript.

> [!WARNING]
> ROGµE is currently in alpha. Features are added frequently, and breaking changes may happen.
> There is a save migration system in place to update saves on load whenever possible.
> 
> The engine already supports:
> - Running in-browser on desktop and mobile, with click or touch-based UI.
> - "Install" as a [PWA](https://web.dev/articles/what-are-pwas) via "Add to Home Screen"
> - Sprite and glyph-based (ASCII) graphics, swappable on the fly
> - Zoom and pan
> - Auto-save and load, save version migration
> - Flexible attribute system, XP, and level-up rules
> - Food and hunger
> - Inventory, containers, items, equipment, ammunition
> - Creatures/monsters
> - Melee and ranged combat
> - Expandable "senses" system for creature and player perception (vision, hearing, smell)
> - Goal-based, flexible AI system. Monsters use equipment and communicate.
> - Expandable map generation system - pipelines and stages - supporting static and random (BSP, CA, etc.) maps
> - Complete game loop with win and loss conditions
> - Web audio SFX and background music
> - Extensive documentation via short "how-to" guides

(For a peek at what's coming up next, check out `/docs/roadmap.md`)

## Why a Traditional Roguelike?

Traditional roguelikes are great projects for brand new game devs, and equally fun for seasoned pros. Unlike many games that call themselves roguelikes or roguelites, "traditional" roguelikes are asset-light, but systems-heavy. You don’t need to make loads of art, story, or music and sound to produce a great roguelike. You don’t need 3D models or textures.

Traditional roguelikes rely on simple systems that interact with one another in interesting ways. They use randomization to ensure that no two playthroughs are the same. As a developer, you can start with simple systems and add complexity over time. Many popular roguelikes have been slowly developed over years, and even decades!

Roguelikes also have an amazing community of players and developers. There are events like [7DRL](https://7drl.com) and great resources like [r/roguelikes](https://www.reddit.com/r/roguelikes), [r/roguelikedev](https://www.reddit.com/r/roguelikedev/), [Rogue Basin](https://www.roguebasin.com/index.php/Roguelike_Dev_FAQ), and [Rogue Temple](https://forums.roguetemple.com/index.php).

## Why ROGμE?

There are several good game engines for roguelikes. ROGμE tries to make life easier for developers in a few ways.

1. **It’s already a game!** Every system in ROGμE comes pre-populated with data. It’s playable as a game straight out of the box. You can start by tweaking settings, adding new items, or totally overhauling major systems. It’s up to you.
2. **It’s web-native and cross platform.** It uses vanilla JavaScript and HTML. You can play it on mobile, tablet or desktop. No server setup or install necessary. In fact, you can play it [on GitHub right now](https://samuel-t-johnston.github.io/micro-rogue/), thanks to GitHub Pages.
3. **It’s AI- and human-friendly!** ROGμE is designed from the ground up to work well with autonomous agents and AI coding assistants. Not using AI? No problem. The same detailed documentation that helps AI understand the codebase is also great for human developers.
	
## How Do I Get Started?

ROGμE is designed to be forked and modified. As soon as you fork the repository on GitHub, you will have a working game. Turn on GitHub Pages for your repo, point it to the main branch and the root directory, and your game is now live and accessible by anyone.

From there, you can try modifying data files, modifying existing code, or adding new features.

### FAQs and How To...

The `/docs/howto` directory contains lots of files with directions for making common changes to ROGμE. These are designed to be helpful to both human devs and AI coding assistants, and provide an easy way to start making the game your own.

The code itself is documented with JS Doc-style comments to help with discovery and understanding.

### Dev Environment Setup

You can make changes to the game by committing them directly and trying it out on GitHub Pages, but this will quickly become a chore. Setting up a development environment on your computer is easy, and will let you instantly test changes and verify everything is working before committing them for the world to see.

`Node.js` is a dev-time dependency only — the shipped game is browser-only with no bundler. 

Setup:

- Install [Node JS](https://nodejs.org/en).
- Clone your GitHub repository to your local machine. (Use command-line git or a tool like GitHub Desktop)
- Navigate your shell to the root of the repository and run:

```
npm install
```

#### Build

There is no build step! Source files are served directly to the browser as ES modules. To deploy, copy the repo contents (excluding `node_modules/`) to any static host. Since you will already have Node installed, that's the easiest option. Use the commands below.

(Note: Whenever you commit changes that impact what files the browser loads, bump the cache version in `service-worker.js`.)

## Run

Local dev (live-server on `http://127.0.0.1:8000` with auto-reload):

```
npm run dev
```

Kill dev server:

```
npm run dev:kill
```

Kill any running instances and start server:

```
npm run dev:fresh
```

The dev server serves the repo root, so `index.html` at the root, `src/` modules, and `styles/` all resolve via relative paths. Any static server pointed at the repo root works (e.g. `npx serve .`).

## Testing

### Framework

ROGμE uses Vitest with `happy-dom` for tests that need a DOM. Test files live alongside source as `*.test.js`.

Run tests with `npm test` (watch mode) or `npm run test:run` (single pass). For a coverage report, run `npm run test:coverage` (single pass with a per-file text summary, via `@vitest/coverage-v8`).

### Linting & Formatting

ESLint handles code quality and JSDoc shape; Prettier handles formatting. Run them before committing:

```
npm run lint          # report ESLint issues
npm run lint:fix      # auto-fix what ESLint can
npm run format        # apply Prettier formatting
npm run format:check  # check formatting without writing
```

## Credits

ROGμE is made by Sam Johnston, with help from Claude Code 🤖.
