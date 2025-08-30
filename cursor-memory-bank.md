# Cursor Memory Bank

## CURRENT STATUS: Unit Tests Complete ✅
- Successfully completed comprehensive unit test evaluation and improvements
- Added 11 comprehensive tests for `useFurniture` function
- All 200 tests now passing across 10 test suites
- Current test coverage: `pickUpItem` (7), `movePlayer` (16), `useFurniture` (11)

## NEXT TASK: UI Tab System for Inventory/Equipment 🎯
**Goal:** Split the "Inventory and Equipment" section of the UI into two separate tabs within the panel
- **Inventory Tab:** Display player's inventory items
- **Equipment Tab:** Display player's equipped items and equipment slots
- **Implementation:** Add tab switching functionality to the existing UI panel

## RECENT WORK COMPLETED:
- ✅ Added comprehensive `useFurniture` tests covering:
  - Basic functionality (no furniture, non-usable furniture)
  - State toggling (open/closed, container handling)
  - Container interactions (items, empty containers)
  - Edge cases (toggle failures, unknown actions)
  - UI callbacks and position calculations
- ✅ Fixed all test failures and data structure issues
- ✅ Improved test suite robustness and maintainability

## TECHNICAL NOTES:
- `useFurniture` function handles furniture state toggling and container interactions
- Tests use proper mocking for `renderer.js`, `ui.js`, and `world.js`
- Furniture data structure matches actual `furniture.json` format
- Container messages include status format: "(X/Y items)" or "It is empty"

## PROJECT CONTEXT:
- JavaScript roguelike game with modular architecture
- Comprehensive test suite with Jest
- UI system with inventory and equipment management
- Furniture system with stateful objects and containers
