**Rogµe** (or Micro-Rogue) is a traditional [roguelike game](https://en.wikipedia.org/wiki/Roguelike) in early development. It is written in Javascript and HTML5. 

Rogµe was started primarily as a playground to experiment with agentic AI tools. I'm currently using Cursor. Apologies for any rough code. It has been many years since I wrote Javascript regularly, and the language has changed. I'll be relying on the AI quite a bit at first, and refactoring as I go.

# State of the Game

 - Latest Version: 0.0.1 "Path to Playability"
 - Latest Stable Version: N/A

The game is very early, but already includes a number of important features:

 - UI with menu, stats, map, messages, inventory, and controls
   - Some support for different "choice modes" with hotkeys for particular actions
 - Loading static map content from file
 - Player character movement
 - Items and picking up
 - Dungeon "Furniture" like boulders, doors, and chests
   - Doors and chests can be opened. Chests can be looted

The dev side of the project includes:
 - Unit tests (Jest/Babel) - mostly by AI
 - Linting (ESLint)
 - Code Formatting (Prettier)
 - Documentation File (code-doc.txt) - mostly by AI
 - Game Design File (game-design.txt) - mostly by AI
 - .cursorrules and .cursor-memory-bank - to keep the AI in line

## Roadmap

0.0.x versions are laying basic groundwork for the game, with 0.1.0 being the first minor "release".

### 0.0.1 - Groundwork
 - Create GitHub repository
 - Add license
 - Add readme
 - Refactoring early work
 - Improved project structure

### 0.0.2 - Persistence
 - Saving & loading

### 0.0.3 - Materialism
 - Items do things
   - Equip, unequip equipment
   - Equipment alters character stats
   - Usable item example - Potion

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

### 0.1.1 - CRB - cleanup, refactoring, and bugfixes.

### 0.2.0 - Bling and Bad Guys
 - Rings
 - Packs
 - More enemies
 - AI - aggro (pathfinding?)