player hear/sound goal - should this be a goal? Can't smell/hear when auto goals active

classes vs loose functions - style questions?

multi-option select: close the door, or walk through?

UI anchor system

additional tests for items and equipment, picking up, equip/unequip?
More happy-dom tests

jsdoc comments everywhere

item/furniture files in data. Components?


turnCount is currently hardcoded to 0 (action-system.js:38). Doesn't matter for wander, but vision stamps turnObserved with it, and NPC stale-data reasoning will eventually need a real monotonic tick. The turn manager only exposes playerTurnCount. I'd leave it at 0 for now but note it as the next thing to thread when we add a pursue/investigate goal.
-> TimeSense component that tracks the entity's own turn count?


close door when blocked?

getting monsters some default equipment

https://code.claude.com/docs/en/code-review

light levels
maybe a new vision sense? And the light-indifferent sense becomes darkvision?

pathfinding reads `context.level` directly rather than a sense-filtered "known map" (tracked in ADR-021).

Standard formatting for aliases in howto files.

"Save" button that tells the user about auto-save.


At final milestone, evaluate all assertions in howtos and design docs. Cleanup and tighten the screws.
GitHub community standards.
