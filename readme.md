**Rogµe** (or Micro-Rogue) is a traditional [roguelike game](https://en.wikipedia.org/wiki/Roguelike) in early development. It is written in Javascript and HTML5. 

I created Rogµe as a playground to experiment with agentic AI tools. I'm currently using Cursor. Apologies for any rough code. It has been many years since I wrote Javascript regularly, and the language has changed. I'll be relying on the AI quite a bit at first, and refactoring as I go.

# State of the Game

Latest Version: 0.0.3 "Materialism"
 - Equipping and unequipping equipment
 - Equipment has effects when equipped
 - Dropping items
 - UI - Attributes tab - view stats and effects on character
 - Consumable items

The game is very early, but already includes a number of important features:

 - UI with menu, stats, map, messages, inventory, and controls
   - Some support for different "choice modes" with hotkeys for particular actions
 - Loading static map content from file
 - Player character movement
 - Items, picking up, dropping
 - Equipment and effects that modify character stats
 - Dungeon "Furniture" like boulders, doors, and chests
   - Doors and chests can be opened. Chests can be looted
 - Saving, loading, autosave

## Roadmap

(0.0.x versions are laying basic groundwork for the game, with 0.1.0 being the first minor "release".)

### 0.0.4 - Life
 - NPC gen from static map file
   - NPC types
   - NPC AI - wander, attack adjacent
 - “Look at” action / Target choice mode
	
### 0.0.5 - Death
 - Death
 - Losing
 - Attacking 
   - Player
   - NPC

### 0.0.6 - Winning
 - Exit door, winning, score 

### 0.1.0 - First Minor Release - Technically a Game!
 - Debug tools
   - Game state dump
   - Game state for tile
   - Debug log
 - Package to executable (Electron?)
 - Configuration?

### 0.1.1 - CRB - cleanup, refactoring, and bugfixes.
- Test Coverage

### 0.2.0 - Bling and Bad Guys
 - Rings
 - Packs
 - More enemies
 - AI - aggro (pathfinding?)

# Developer Setup

**Dependencies:**

Rogµe is pure client-side Javascript, HTML, and CSS. However, there are some external dependencies I use for serving the files, testing, and cleanup in development.

 - Python - Currently used to easily serve files locally
 - npm - Package management for everything JS.
   - Jest/Babel - unit tests
   - ESLint - linting
   - Prettier - code formatting
 - Cursor (optional)
   - .cursorrules - hints to make the AI more effective
   - cursor-memory-bank.md - Simple AI memory bank

**Developer Setup:**
 - `npm install` to download dependencies.
 - `start-server.bat` to run the game on localhost:8000
 - The `scripts` directory includes additional scripts to easily lint, unit test, and prettify.
