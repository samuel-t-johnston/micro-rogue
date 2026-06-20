# PWA, offline caching, and icons

ROGµE installs as a PWA and runs offline via a service worker (`service-worker.js`,
registered from `src/main.js`). This guide covers the two things you have to touch by hand.

## Deploying a new version

The service worker is **network-first**: when the device is online it always fetches fresh
files and updates the cache, so a normal deploy is picked up on the next reload without any
action. The cache only matters offline.

If you ever need to *force* every client to drop its cached copies (e.g. you removed or renamed
assets and want stale ones gone immediately), bump the version string in `service-worker.js`:

```js
const CACHE_VERSION = 'rogue-v1'; // -> 'rogue-v2'
```

On activation the worker deletes every cache whose name isn't the current version, so the old
set is cleared within one reload.

## Why there's no asset manifest to maintain

There is **no build step and no generated file list**. On the first online load the browser
fetches the whole static-import module graph (all of `src/`), both stylesheets, and the active
sprite sheet; network-first caches each one automatically. So almost everything self-caches.

The exceptions are assets the app loads *lazily*, which a given session might never request:

- the sprite-sheet size that isn't in use (`assets/sprites/sprite-sheet-16.png` /
  `-32.png`), loaded via `new URL(...)` in `src/render/sprite-renderer.js`
- every dynamically `import()`-ed map layout (`data/maps/*.js`), loaded in
  `src/world/generation/static-layout.js`

These are precached explicitly via `DYNAMIC_ASSETS` in `service-worker.js`. **When you add a
new `data/maps/*.js` layout, add a line to that list** — that's the only maintenance the
offline cache needs. (Pipelines, the transit map, and everything else under `data/` are
statically imported, so they self-cache and don't belong in the list.)

## Icons

The home-screen / install icon is the green **µ** glyph (matching `favicon.ico`), rendered
crisp at the sizes platforms actually use:

| File | Used by |
| --- | --- |
| `icons/icon-180.png` | iOS `apple-touch-icon` (`<link>` in `index.html`) |
| `icons/icon-192.png` | manifest, `purpose: "any"` |
| `icons/icon-512.png` | manifest, `purpose: "any"` |
| `icons/icon-512-maskable.png` | manifest, `purpose: "maskable"` (extra safe-zone padding for Android adaptive masks) |

iOS does **not** use `favicon.ico` or the manifest icons reliably for the home screen — it
needs the `apple-touch-icon` PNG link. Without it, iOS generates a placeholder (a white "R"
from the title), which is the bug this setup fixes.

The PNGs are committed as static assets (no runtime generation). They were produced from the
favicon's green-µ design on the manifest `background_color` (`#0a0e0a`). To regenerate after a
brand change, re-render the same glyph/sizes — see the icon-rendering step in the M7 history.
