# Cursor Memory Bank

## CURRENT STATUS: Consumable System Complete
- Complete refactoring: modular architecture, 377 tests passing (1 skipped)
- Character system with save/load functionality implemented
- Data-driven rendering and mode-agnostic UI
- Equipment system with inventory-based equipping and removal implemented
- DataFileLoader system for centralized data loading implemented
- **COMPLETED**: Equipment effect system with centralized templates and character effect tracking
- **COMPLETED**: Legacy property removal - Character class now uses baseStats/bonusedStats exclusively
- **COMPLETED**: StatBlock class implementation - Encapsulated character statistics with utility methods
- **COMPLETED**: Stat system alignment - Added guard and attack stats, updated effects to match
- **COMPLETED**: Effect-centric refactoring - Effects now know how to apply and remove themselves
- **COMPLETED**: Consumable system - Immediate one-time effects for potions and food items

## RECENT CHANGES: Consumable System Implementation (Latest Session)

### What We Accomplished:
1. **Updated Potion Vial Item**: 
   - Changed from `usable` property to `consumable` property
   - Updated effect from `currentHp+1` to `currentHp+5` for better gameplay
   - Changed `use_effect` to `consume_effect` for clarity
2. **Added Consume Action**: 
   - Added "C" hotkey to DefaultMode for consuming items
   - Added consume action to NumericMode for item selection
   - Updated control instructions to include "C: Consume item"
3. **Created Consume Logic**: 
   - Added `getConsumableItems()` function to filter consumable items from inventory
   - Added `consumeItemByIndex()` function to handle item consumption
   - Implemented simple parsing for immediate effects (e.g., "currentHp+5")
   - Used existing `heal()` method for HP restoration
4. **Updated Item Validation**: 
   - Updated test rules to expect `consumable` instead of `usable`
   - Updated validation patterns for `consume_effect` property
   - Fixed all related tests to use new property names

### New Consumable System:
- **Immediate Effects**: One-time effects that don't persist (unlike equipment effects)
- **Simple Parsing**: Direct stat modifications without complex effect system
- **Clear Separation**: Consumables vs equipment effects are distinct systems
- **User-Friendly**: "C" hotkey makes consuming items intuitive
- **Extensible**: Easy to add new consume effect types in the future

### Benefits:
- **Clear Distinction**: Consumables are immediate, equipment effects are persistent
- **Better UX**: Dedicated consume action with clear hotkey
- **Simpler Logic**: Immediate effects don't need complex state management
- **Future Ready**: System ready for scrolls, wands, and other one-use items
- **Incremental Design**: Focused on consumables first, other item types later

### Bug Fixes:
1. **Fixed Missing Game Actions**: Added `getConsumableItems` and `consumeItemByIndex` to the `gameActions` object in `inputHandler.js`
   - **Root Cause**: Functions were exported from `gameLogic.js` but not included in the `gameActions` object passed to choice modes
   - **Solution**: Updated imports and `createGameActions()` method to include the missing functions

2. **Fixed Missing UI Display**: Added consume action case to `updateControlsUI()` in `ui.js`
   - **Root Cause**: UI had cases for `pickup`, `equip`, `remove`, and `drop` actions but was missing `consume` action
   - **Solution**: Added `else if (context && context.action === 'consume' && context.items)` block to display consumable items list

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
- **Item dropping**: 'X' key to drop items from inventory, smart container detection and placement
- **UI bug fix**: Fixed inventory items display in drop action NumericMode

### Data Loading System
- **DataFileLoader class**: Centralized data loading with caching support
- **Eliminated duplication**: Consolidated `loadItems()` and `loadFurniture()` functions
- **Consistent error handling**: Unified approach across all data loading operations
- **Future-ready**: Easy to extend for new data types (monsters, spells, etc.)

### Test Coverage
- **334 tests passing** across 14 test suites (1 skipped)
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

## EQUIPMENT EFFECT SYSTEM DESIGN
====================================

### GOALS
- Implement centralized effect templates for easy maintenance and extensibility
- Support regex-based effect parsing for flexible effect definitions
- Track effect sources (equipment, spells, abilities) for future expansion
- Separate base stats from bonused stats for clear UI display
- Support both immediate effects (apply/remove) and ongoing effects (each turn)
- Add effect validation through unit tests for development-time error catching

### DESIGN CONSIDERATIONS
- **Effect Stacking**: Additive for now, extensible for complex interactions later
- **Effect Categories**: Group effects by type (defense, health, offense, debuff)
- **Source Tracking**: Each effect knows its source for proper removal
- **Temporary Effects**: Support for effects with turn counts and expiration
- **Ongoing Effects**: `eachTurn` function for damage over time, regeneration, etc.
- **Character Integration**: Base stats vs bonused stats separation
- **Validation**: Static analysis in unit tests, not runtime validation

### CURRENT ITEMS WITH EFFECTS
From items.json:
- leather_helm: "armor+1" (head slot)
- leather_armor: "armor+1" (body slot)  
- leather_gloves: "armor+1" (hands slot)
- leather_tassets: "armor+1" (legs slot)
- leather_shoes: "armor+1" (feet slot)
- amulet_of_health: "hpBonus+2" (neck slot)
- iron_dagger: "attack+1" (weapon slot)
- iron_buckler: "armor+1" (weapon slot)

### IMPLEMENTATION PLAN

#### 1. Effect Registry (src/js/systems/effectRegistry.js)
```javascript
export const EFFECT_TEMPLATES = {
  armor_up: {
    regex: /^armor\+(\d+)$/,
    category: 'defense',
    apply: (character, value, source) => { /* add effect to character */ },
    remove: (character, value, source) => { /* remove effect from character */ },
    eachTurn: null // No ongoing effect
  },
  hp_bonus: {
    regex: /^hpBonus\+(\d+)$/,
    category: 'health',
    apply: (character, value, source) => { /* add effect to character */ },
    remove: (character, value, source) => { /* remove effect from character */ },
    eachTurn: null
  },
  attack_up: {
    regex: /^attack\+(\d+)$/,
    category: 'offense',
    apply: (character, value, source) => { /* add effect to character */ },
    remove: (character, value, source) => { /* remove effect from character */ },
    eachTurn: null
  },
  // Example temporary effect
  poison: {
    regex: /^poison\+(\d+)$/,
    category: 'debuff',
    apply: (character, value, source) => { /* add with turn count */ },
    remove: (character, value, source) => { /* remove effect */ },
    eachTurn: (character, value) => { /* damage each turn */ }
  }
};
```

#### 2. Enhanced Character Class (src/js/entities/character.js)
Add to constructor:
```javascript
// Effect tracking
this.effects = [];

// Base stats (separate from bonuses)
this.baseStats = {
  body: body,
  mind: mind,
  agility: agility,
  control: control,
  hpBonus: hpBonus
};

// Bonused stats (calculated from base + effects)
this.bonusedStats = {
  body: body,
  mind: mind,
  agility: agility,
  control: control,
  hpBonus: hpBonus
};
```

Add methods:
```javascript
addEffect(effect) { /* add effect and recalculate stats */ }
removeEffect(type, source) { /* remove effect and recalculate stats */ }
recalculateStats() { /* apply all effects to base stats */ }
processEffects() { /* handle each-turn effects and expiration */ }
```

#### 3. Effect Manager (src/js/systems/effectManager.js)
```javascript
export class EffectManager {
  static parseEffect(effectString) { /* parse effect string using regex */ }
  static applyEffect(character, effectString, source) { /* apply parsed effect */ }
  static removeEffect(character, effectString, source) { /* remove parsed effect */ }
  static validateEffect(effectString) { /* validate effect format */ }
}
```

#### 4. Equipment Integration (src/js/core/gameLogic.js)
Modify equipment functions:
```javascript
// When equipping:
EffectManager.applyEffect(character, itemData.equipment.effect, 'equipment');

// When unequipping:
EffectManager.removeEffect(character, itemData.equipment.effect, 'equipment');
```

#### 5. Unit Test Integration
Add to existing item validation tests:
```javascript
test('all equipment items have valid effects', () => {
  const items = loadItems();
  for (const [itemId, itemData] of Object.entries(items)) {
    if (itemData.equipment && itemData.equipment.effect) {
      expect(EffectManager.validateEffect(itemData.equipment.effect)).toBe(true);
    }
  }
});
```

### IMPLEMENTATION ORDER
1. Create effectRegistry.js with basic effect templates
2. Create effectManager.js with parsing and application logic
3. Enhance Character class with effect tracking and stat separation
4. Integrate with existing equipment system in gameLogic.js
5. Add unit tests for effect validation
6. Test with existing items to ensure effects work correctly

## PROJECT CONTEXT:
- JavaScript roguelike game with Jest testing
- ES6 modules, modern web development practices
- Ready for feature development phase