---
language: english
formatting:
  tables: false
  bold_emphasis: minimum
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# NAI Tag Builder

Mobile-first bookmarklet overlay for the NovelAI image generation page.

It helps users compose, import, save, queue, and apply NovelAI prompts without leaving the browser page or typing long Danbooru-style prompt strings by hand.

## Current Scope

- Bookmarklet-injected React overlay on `novelai.net/image`.
- Mobile-oriented compact UI with collapsible sections and a circular collapsed launcher.
- Main / Undesired prompt pair editor with tab and split views.
- Character / Character Undesired prompt pair editor with the same tab and split model.
- Tag dictionary chips with prompt-target badges.
- Presets and queue automation.
- NovelAI metadata import from image files.
- NovelAI metadata apply pipeline through generated PNG paste/import.

## Bookmarklet

Use the hosted GitHub Pages bundle:

```js
javascript:(()=>{document.getElementById("nai-tag-builder-loader")?.remove();document.getElementById("nai-tag-builder-root")?.remove();const s=document.createElement("script");s.id="nai-tag-builder-loader";s.src="https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?t="+Date.now();document.body.appendChild(s);})()
```

The `?t=` cache buster only forces the browser to request a fresh URL. It does not fix a stale GitHub Pages artifact. After changing code, always build, commit, push, then verify the remote bundle with a sentinel string.

## How It Works

1. The bookmarklet injects `nai-tag-builder.js` into the NovelAI page.
2. React renders the overlay with `flushSync()` because NovelAI's page can prevent normal async React rendering from flushing reliably.
3. The user edits prompts, parameters, characters, presets, and queue options inside the overlay.
4. Apply builds a NovelAI-compatible `Comment` JSON payload.
5. The app generates an in-memory PNG with the required NovelAI metadata chunks.
6. A synthetic paste/import path delivers that PNG to NovelAI so NovelAI's own Import flow fills its React state.

Direct DOM writes to NovelAI inputs are intentionally not the main strategy. NovelAI uses React-controlled state, so direct input mutation can be overwritten by React. Metadata import is the reliable path.

## Image Import

The Load Image button supports image files, including `.png` and `.webp`.

Import tries multiple paths:

- PNG `tEXt`
- PNG `iTXt`
- PNG `zTXt`
- Alpha-channel LSB stealth metadata with `stealth_pngcomp`

The stealth path decodes pixels through browser APIs:

- `createImageBitmap()`
- canvas / `OffscreenCanvas`
- `getImageData()`
- alpha LSB extraction in column-major order
- `stealth_pngcomp` signature scan
- 32-bit big-endian compressed payload length
- `pako.inflateRaw()` with gzip fallback

This allows old NovelAI images to recover prompt metadata even when normal EXIF or PNG text chunks are missing, as long as the hidden alpha LSB payload survived the image conversion.

## UI Notes

The overlay is optimized for narrow screens.

- Repeated field subtitles above prompt textareas are removed.
- Prompt identity is shown through tabs and color, not duplicate labels.
- Sections collapse independently.
- The whole overlay can resize from all four edges.
- The collapsed state becomes a small circular launcher, not a full-width bar.
- Theme colors are sampled from NovelAI's actual DOM instead of CSS variables.

## Theme Sync

NovelAI uses Styled Components and hashed classes, not stable CSS custom properties. Theme sync works by sampling computed styles from host DOM elements.

The app samples:

- page and panel backgrounds
- prompt/input backgrounds
- number/select input backgrounds and borders
- readable text colors by contrast against the sampled surface
- Generate button accent color
- NovelAI intensity colors through temporary probe elements

The sampler avoids using button/tag colors as general text colors. This matters on light NovelAI themes where a white button label can otherwise be incorrectly applied to beige overlay surfaces.

## Development

```bash
npm install
npm run build
npm run lint
npm run test:e2e:bookmarklet
npm run test:e2e:compose
```

The production artifact is:

```text
dist/nai-tag-builder.js
```

Commit and push the built `dist` file when updating the hosted bookmarklet bundle.

## Tech Stack

- React
- TypeScript
- Vite
- Dexie
- pako
- Playwright smoke tests
