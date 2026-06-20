# Handedness

*Mirroring the corner-anchored UI for left-handed reach.*

The corner controls (HUD, message-log button, character-menu button, game-menu button) mount
to *logical* anchors and resolve to *physical* corners through the `handedness` setting. The
default `right` is the identity; `left` reflects every corner anchor horizontally so the
primary controls fall under the other thumb.

## How a widget opts in

Each corner widget declares its right-handed anchor and runs it through
[`applyHandedness`](../../src/ui/anchor-system.js) before placing itself:

```js
import { Anchor, applyHandedness, placeBox } from '../anchor-system.js';
import { gameSettings } from '../../engine/settings.js';

const ANCHOR = Anchor.BOTTOM_RIGHT; // right-handed home
function buttonRect() {
  const anchor = applyHandedness(ANCHOR, gameSettings.get('handedness'));
  return placeBox(anchor, getViewport(), { w: 44, h: 44, margin: 12 });
}
```

`applyHandedness` swaps `*_LEFT ↔ *_RIGHT` (and `LEFT_CENTER ↔ RIGHT_CENTER`); center-column
anchors are unchanged. `placeBox` does the corner math — it insets a `w×h` box inward from
whichever edges the anchor touches — so mirroring is *just* mirroring the anchor; the inset
direction follows automatically. Text widgets (the HUD, the log's ghost lines) additionally
flip their `align` to the mirrored edge so the text reads inward rather than off-screen.

Because the widgets read `gameSettings` every frame, toggling handedness updates the layout on
the next frame — there's no re-layout event to fire.

## The setting

`handedness` lives in the persisted settings store
([`src/engine/settings.js`](../../src/engine/settings.js)) under the `rogue:settings`
localStorage key, loaded once at boot in `main.js`. It is surfaced as a toggle row on the
**Settings** sub-page of the game menu (see [menus.md](menus.md)); selecting the row flips and
persists the value in place. The store is the home for future UI preferences (vignette,
reduced motion); see the [UX design doc](../design/ux-design.md) accessibility section.

## Why mirror all four corners

The two bottom controls (log, character menu) and the two top controls (HUD, game menu) swap
sides pairwise, so a full mirror never collides — the control vacating a corner is replaced by
the one arriving from the opposite side. Mirroring only one button would leave it on top of
whatever already occupies the destination corner.
