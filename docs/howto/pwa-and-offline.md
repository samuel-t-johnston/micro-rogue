# PWA, offline caching, and icons

ROGµE installs as a PWA and runs offline via a service worker (`service-worker.js`,
registered from `src/main.js`). This guide covers the two things you have to touch by hand.

## Deploying a new version

**Bump `CACHE_VERSION` in `service-worker.js` on every deploy.**

```js
const CACHE_VERSION = 'rogue-v1'; // -> 'rogue-v2'
```

It does two jobs:

1. The changed worker bytes are what make the browser install a new service worker. This matters
   most on **iOS**: an installed (home-screen) PWA will otherwise sit on old code indefinitely —
   the symptom is "Safari shows the update but the installed app doesn't, and force-quitting
   doesn't help" (only a delete/reinstall did). Bumping the version avoids that.
2. On `activate` the new worker deletes every cache whose name isn't the current version, clearing
   the old asset set.

When a new worker activates, `src/main.js` auto-reloads the page (guarded so it doesn't fire on
first install) so the running app immediately picks up the fresh assets.

The worker is **network-first** with revalidation: online it fetches fresh with
`cache: 'no-cache'` (bypassing the browser's own HTTP cache, so it can't serve a stale on-device
copy) and updates Cache Storage; offline it serves the cached copy. So even without remembering
the bump, a normal reload gets fresh content — the bump is the belt-and-suspenders that also
reaches installed iOS PWAs.

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
needs the `apple-touch-icon` PNG link. Without it, iOS generates a placeholder (first letter of
 the title), which is the bug this setup fixes.

The PNGs are committed as static assets (no runtime generation). They were produced from the
favicon's green-µ design on the manifest `background_color` (`#0a0e0a`). To regenerate after a
brand change, re-render the same glyph/sizes — see the icon-rendering step in the M7 history.
