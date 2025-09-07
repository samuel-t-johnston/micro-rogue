# Cursor Memory Bank

## CURRENT STATUS: Ready for New Features
- Complete refactoring: modular architecture, 276 tests passing
- Character system with save/load functionality implemented
- Data-driven rendering and mode-agnostic UI

## MAJOR REFACTORING COMPLETED:

### Architecture Changes
- **Project Structure**: Moved to `src/js/` with organized subdirectories (core, entities, systems, utils, ui)
- **Input System**: Class-based choice modes with registry pattern, mode-agnostic UI
- **Data Flow**: Immutable config, direct parameter passing, eliminated global state
- **Rendering**: Data-driven symbols from JSON, centralized helper functions

### Character System
- **Multi-character support**: `Character` class with `symbol`, `x`, `y`, `isPlayer` fields
- **Position management**: Characters stored in `DungeonLevel.characters` array with internal coordinates
- **Collision detection**: `isPassible()` checks for character presence
- **Rendering priority**: Characters > Furniture > Items > World tiles

### Save/Load System
- **Persistence**: Complete save/load using localStorage with `SaveSystem` class
- **Auto-save**: Configurable frequency (every 10 turns by default)
- **Serialization**: Handles complex objects (Character, Furniture, Maps)
- **Version control**: `saveFileCompatibilityVersion` for future migration

### Test Coverage
- **276 tests passing** across 14 test suites
- **New test files**: `dungeonLevel.test.js`, `gameState.test.js`, `saveSystem.test.js`
- **Updated tests**: Character system, world generation, save/load functionality
- **Comprehensive coverage**: All new features and existing functionality

## CURRENT ARCHITECTURE:
```
game.js (orchestrator) → InputHandler → ChoiceModeManager → Mode classes
DungeonLevel (characters array) → Character objects with x,y coordinates
SaveSystem (serialization) → localStorage persistence
Renderer (data-driven) → JSON symbols and helper functions
```

## TECHNICAL NOTES:
- Constructor-based dependency injection
- Modular architecture with clear responsibilities
- Data-driven content (items/furniture from JSON)
- Mode-agnostic UI with dynamic display generation
- Comprehensive test coverage ensures reliability

## PROJECT CONTEXT:
- JavaScript roguelike game with Jest testing
- ES6 modules, modern web development practices
- Ready for feature development phase