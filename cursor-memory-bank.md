# Cursor Memory Bank

## CURRENT STATUS: Ready for New Features
- Complete refactoring: modular architecture, 319 tests passing (1 skipped)
- Character system with save/load functionality implemented
- Data-driven rendering and mode-agnostic UI
- Equipment system with inventory-based equipping and removal implemented

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

### Equipment System
- **Inventory-based equipping**: 'E' key triggers equipment selection from inventory
- **Slot management**: Equipment slots (head, body, hands, legs, feet) with collision detection
- **Replacement confirmation**: YNMode for handling occupied slots with inventory management
- **Choice mode integration**: NumericMode for equipment selection, YNMode for confirmation
- **Game actions**: Complete equipment logic in gameLogic.js with InputHandler integration
- **UI display**: Equipment items shown with numbered list in controls (like pickup system)
- **Bug fixes**: Fixed unequipItem method to properly return unequipped items to inventory
- **Weapon equipping**: Automatic slot selection for weapons (weapon1/weapon2), dual-wielding support
- **Weapon replacement**: NumericMode dialog for selecting which weapon to replace when both slots full
- **Equipment removal**: 'R' key to remove equipped items, inventory management with drop confirmation

### Test Coverage
- **302 tests passing** across 14 test suites
- **New test files**: `dungeonLevel.test.js`, `gameState.test.js`, `saveSystem.test.js`
- **Updated tests**: Character system, world generation, save/load functionality, choice modes
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