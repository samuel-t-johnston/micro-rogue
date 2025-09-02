# Cursor Memory Bank

## CURRENT STATUS: Code Refactoring - Game.js Complete ✅
- Successfully completed major refactoring of `game.js` and related systems
- Moved from monolithic structure to clean, modular architecture
- All 200 tests passing across 10 test suites

## REFACTORING WORK COMPLETED:

### 1. Project Structure Reorganization ✅
- Moved JavaScript files to `src/js/` subdirectories:
  - `core/`: game.js, gameState.js, gameLogic.js
  - `entities/`: character.js, furniture.js
  - `systems/`: inputHandler.js, renderer.js, choiceModeManager.js
  - `utils/`: coordinates.js, config.js
  - `ui/`: ui.js
- Moved JSON data files to `src/data/` subdirectories:
  - `furniture/`, `items/`, `levels/`
- Moved web assets to `src/web/`: index.html, style.css
- Updated all import paths and references throughout codebase

### 2. Menu Event Handling Refactor ✅
- Created `addMenuEventListeners()` function in `game.js`
- Separated menu actions from input handling logic
- Handles `newGameRequested` event separately from keyboard input
- Easy to extend with future menu actions

### 3. InputHandler Architecture Refactor ✅
- Moved `gameActions` object into `InputHandler` class
- `InputHandler` now creates its own game actions internally
- Constructor takes `updateGameUICallback` directly (no separate setter)
- Cleaner separation of concerns: `game.js` orchestrates, `InputHandler` handles input

### 4. Package.json and Scripts Updates ✅
- Updated all npm scripts to work with new `src/` structure
- Fixed JSDoc script to use `npx jsdoc -r src -d docs/jsdoc`
- Updated lint and format scripts to target `src` directory
- Start server script now serves from project root (fixed 404 issues)

### 5. World.js Simplification ✅
- Removed redundant `initializeWorldAsync()` wrapper function
- Renamed `initializeWorldV2()` to `initializeWorld()` (no v1 exists)
- Eliminated unnecessary function indirection
- Updated all imports and test references
- Cleaner, more direct API for world initialization

### 6. Config.js Refactoring ✅
- Renamed `GAME_CONFIG` to `CONFIG_SETTINGS` for better clarity
- Added `viewportWidth` and `viewportHeight` for future UI settings
- Kept legacy values temporarily for backward compatibility
- Updated all imports and references throughout codebase
- Updated test mocks to use new naming convention
- All 200 tests still passing after refactoring

### 7. Immutable Configuration Architecture ✅
- **Eliminated mutable global state**: Removed mutation of `CONFIG_SETTINGS` in `world.js`
- **Direct data passing**: `initializeWorld()` now returns full level data object
- **Parameterized constructors**: `DungeonLevel` accepts player start position as parameters
- **Flexible renderer**: `render()` function accepts viewport dimensions as parameters
- **Clean separation**: Static UI config vs dynamic level data
- **Updated gameLogic**: Creates `DungeonLevel` with proper level data from file
- **Removed legacy values**: Cleaned up `CONFIG_SETTINGS` to only contain viewport settings
- **Fixed tests**: Updated to work with new immutable approach
- **All 200 tests passing**: Confirmed refactoring maintains functionality

### 8. Items Placement Refactoring ✅
- **Eliminated wrapper functions**: Removed `placeRandomItems` and `placeLoadedItems`
- **Single responsibility**: Created `placeItems` function that takes level data directly
- **Removed global dependencies**: No more reliance on `window.loadedLevelData`
- **Direct parameter passing**: Level data passed explicitly from `gameLogic.js`
- **Updated tests**: All tests now use new `placeItems` function with direct level data
- **Cleaner API**: More explicit and testable function signature
- **All 200 tests passing**: Confirmed items refactoring maintains functionality

### 9. Furniture Placement Refactoring ✅
- **Eliminated wrapper functions**: Removed `placeRandomFurniture` and `placeLoadedFurniture`
- **Single responsibility**: Created `placeFurniture` function that takes level data directly
- **Removed global dependencies**: No more reliance on `window.loadedLevelData`
- **Direct parameter passing**: Level data passed explicitly from `gameLogic.js`
- **Updated tests**: Updated mocks in `gameLogic.test.js` to use new function names
- **Cleaner API**: More explicit and testable function signature
- **All 200 tests passing**: Confirmed furniture refactoring maintains functionality

## CURRENT ARCHITECTURE:
```
game.js (orchestrator)
├── Creates InputHandler with callback
├── Handles menu events via addMenuEventListeners()
└── Manages game lifecycle (startNewGame, etc.)

InputHandler (input management)
├── Creates internal gameActions
├── Handles keyboard events
└── Passes actions to ChoiceModeManager

ChoiceModeManager (input mode switching)
├── Receives gameActions as parameter
├── Works with any gameActions object
└── Handles different input modes
```

## NEXT REFACTORING TARGETS:
- **Choice Mode Manager Refactoring** (Next Priority)
  - Problem: `CHOICE_MODES` object is 180+ lines and will balloon out of control
  - Solution: Hybrid class-based approach with separate mode files
  - Create `src/js/systems/choiceModes/` directory structure
  - Split into: `BaseMode.js`, `DefaultMode.js`, `DirectionalMode.js`, `NumericMode.js`, `ModeRegistry.js`
  - Benefits: Separation of concerns, easy testing, easy extension, better maintainability
- Review remaining JavaScript files for refactoring opportunities
- Look for similar patterns that could benefit from the same architectural improvements
- Focus on: `gameLogic.js`, `gameState.js`, `ui.js`, `renderer.js`

## TECHNICAL NOTES:
- All tests passing (200/200)
- Clean separation between game orchestration and input handling
- Menu actions separated from keyboard input actions
- Constructor-based dependency injection instead of setter methods
- Modular architecture with clear responsibilities

## PROJECT CONTEXT:
- JavaScript roguelike game with comprehensive test suite
- Jest testing framework with 100% test pass rate
- ES6 modules with clean import/export structure
- Modern web development practices and tooling
