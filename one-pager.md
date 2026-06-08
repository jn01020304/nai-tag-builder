---
language: english
formatting:
  tables: false
  bold emphasis: false
  blockquotes: false
writing:
  preamble: false
  filler: false
  closing summary: false
  asides: false
---

# One-Pager

## Product Shape

NAI Tag Builder is a mobile-first bookmarklet overlay for NovelAI image generation.

The user stays on NovelAI, opens the bookmarklet, composes prompts in a compact overlay, imports metadata from old images, saves presets, queues runs, and applies the result back into NovelAI through NovelAI's own metadata import path.

The current design principle is compact operational UI, not a desktop control panel. Repeated helper text is removed where tabs, color, or section headings already communicate the same state.

## Runtime Architecture

The bookmarklet removes any old loader/root nodes, injects the hosted GitHub Pages bundle, and the bundle mounts a React app into `#nai-tag-builder-root`.

React mount uses `flushSync()` because NovelAI's page can prevent normal async React scheduling from flushing reliably.

The overlay root is fixed-position, draggable, resizable from all four edges, and can collapse into a 56px circular launcher.

## Apply Pipeline

The reliable write path into NovelAI is metadata import, not direct DOM mutation.

Pipeline:

1. `MetadataState`
2. `buildCommentJson()`
3. PNG metadata generation
4. DataTransfer / paste dispatch
5. NovelAI Import modal
6. optional Generate button automation

Reason: NovelAI inputs are React-controlled. Native setter tricks can be overwritten by React state reconciliation.

## Import Pipeline

The Load Image input accepts image files, including PNG and WebP.

Single-file parsing tries:

- PNG text metadata (`tEXt`, `iTXt`, `zTXt`)
- pixel-level alpha LSB stealth metadata

Batch parsing returns:

- individual import patches
- failed filenames
- merged MetadataState

Merge behavior is conservative. The first valid scalar settings win, while character prompts can concatenate across files. This prepares the app for future random preset rotation and queue batch generation.

## stealth_pngcomp LSB Format

Signature:

```text
stealth_pngcomp
```

Layout:

```text
[signature 120 bits] [length 32 bits big-endian] [compressed payload bits]
```

Pixel order is column-major:

```text
for x
  for y
    bit = alpha & 1
```

Payload decompression tries `inflateRaw(data.slice(10, -8))` first, then `ungzip(data)`.

This path is format-agnostic after browser decode. If the browser can decode the image to RGBA and the alpha LSB payload survived conversion, the app can recover NovelAI metadata even without EXIF or PNG chunks.

Lossy conversions may destroy the payload.

## Theme Sync

NovelAI does not expose a clean CSS variable theme contract. It uses Styled Components and hashed classes.

The app samples computed styles from host DOM elements:

- page background
- prompt panel background
- textarea/input background
- numeric input background and border
- Generate button accent
- visible readable text colors
- weighted prompt intensity colors via temporary class probe elements

Important correction: text color cannot be copied from the first matching `span`, `main`, or `body`. NovelAI pages can contain white button/tag text on light beige surfaces. The sampler now chooses readable text colors by contrast against the sampled background and filters interactive elements where appropriate.

Theme changes are detected by observing:

- `document.head` style changes
- `document.body` attributes
- body subtree changes

Updates are debounced.

## UI State

Current compact UI decisions:

- Main/Undesired prompt fields use tabs instead of duplicate field subtitles.
- Character prompt pairs use the same tab/split pattern.
- `Insert target: ...` text is removed.
- Collapsed overlay is a circular launcher, not a horizontal bar.
- Overlay resize works on left, right, top, and bottom edges.
- Footer Apply button remains outside body scroll.

## Deployment Freshness

The bookmarklet uses:

```text
?t=Date.now()
```

This bypasses browser cache for the request URL, but it does not force GitHub Pages to serve a newly built artifact.

After any change:

1. `rtk npm run build`
2. commit `dist/nai-tag-builder.js`
3. push `main`
4. fetch the remote URL with a unique `?t=`
5. check for a sentinel string from the change

If the user still sees old UI, check remote bundle freshness before debugging runtime behavior.

## Key Tests

- `rtk npm run lint`
- `rtk npm run build`
- `rtk npm run test:e2e:bookmarklet`
- `rtk npm run test:e2e:compose`

Bookmarklet smoke covers injection, theme sync, four-edge resizing, circular collapse, LSB import, and Generate automation.

Compose smoke covers mobile layout, prompt editing, tab targeting, tag insertion/removal, character prompt targeting, highlight separation, queue controls, and apply lock behavior.

## Open Edges

- Actual NovelAI DOM can shift; selectors and theme probes should remain defensive.
- WebP stealth recovery depends on alpha LSB preservation.
- Direct NovelAI input mutation remains a fallback-only tactic.
- Queue randomization and rotation can build on the batch import merge model but need explicit UX constraints.
