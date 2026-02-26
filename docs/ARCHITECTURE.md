---
language: english
formatting:
  tables: minimum
  bold_emphasis: false
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# Architecture

Goal: build and inject NovelAI generation presets from a single overlay UI on the NovelAI page, without leaving the page.

## Delivery

Bookmarklet injects a `<script>` tag pointing to GitHub Pages. The script is an IIFE that bundles React + all application code into a single file (`nai-tag-builder.js`, ~211KB). No external dependencies at runtime.

Bookmarklet → `<script src="https://...github.io/.../nai-tag-builder.js">` → IIFE executes → fixed-position overlay appears.

## Module Structure

```
src/
  main.tsx                    Entry point. Creates container div, mounts React with flushSync.
  App.tsx                     Orchestrator. Wires state, components, and apply handler.

  types/metadata.ts           CommentJson, MetadataState, CharCaption, Sampler, NoiseSchedule.
  model/defaults.ts           Default values for all metadata fields.
  model/buildCommentJson.ts   Pure function: MetadataState → CommentJson.

  encoding/pngEncoder.ts      Canvas → PNG with tEXt chunks (6 keys) + alpha LSB (stealth_pngcomp).
  encoding/pasteDispatch.ts   Creates ClipboardEvent with DataTransfer, dispatches to ProseMirror.

  hooks/useMetadataState.ts   useReducer managing ~25 fields. Character add/remove auto-syncs positive/negative.

  components/
    CollapsibleSection.tsx    Reusable accordion wrapper.
    PromptSection.tsx         Base prompt textarea.
    GenerationParams.tsx      Width/height (with presets), steps, scale, sampler, noise, seed.
    CharacterCaptions.tsx     Dynamic add/remove. Each: textarea + x/y center inputs.
    NegativePrompt.tsx        Base negative textarea + per-character negatives (auto-synced).
    AdvancedParams.tsx        CFG rescale, uncond scale, SMEA, thresholding, brownian, vibe, coords/order.
    ApplyButton.tsx           Apply button with loading state.

  styles/theme.ts             Catppuccin Mocha color tokens + shared input/label styles.
```

## Data Flow

1. User edits fields → dispatch actions to useMetadataState reducer.
2. Apply button clicked → `buildCommentJson(state)` produces full Comment JSON.
3. `generatePngWithMetadata(json)` creates a canvas, writes LSB bits in alpha channel (column-major), exports to PNG blob, injects 6 tEXt chunks after IHDR.
4. `dispatchPasteEvent(blob)` wraps blob in File/DataTransfer, fires ClipboardEvent on ProseMirror element.
5. NovelAI's paste listener reads tEXt chunks → Import modal → fields populated.

## Key Design Decisions

flushSync for rendering: NovelAI (Next.js) has its own React 19 instance. Our bundled React's async scheduler (MessageChannel) silently fails to fire on this page. `flushSync()` forces synchronous rendering, bypassing the scheduler entirely.

Character sync: Adding a positive character auto-creates a matching negative character entry (same ID). Removing one removes both. This mirrors NovelAI's expectation that char_captions arrays are parallel.

Dual-write for negative prompt: `uc` (legacy string) and `v4_negative_prompt.caption.base_caption` both receive the same negative base text. NovelAI reads both for V3/V4 compatibility.

Seed 0 = random: The seed field stores 0 as "generate random." `buildCommentJson` generates `Math.floor(Math.random() * 2**32)` at apply time, not at state-change time, so each Apply produces a fresh seed.

IIFE format: Vite builds as IIFE so the entire bundle executes immediately when the script tag loads. No module system, no import maps needed on the host page.

CSS-in-JS via inline styles: Avoids leaking styles to NovelAI's page and avoids NovelAI's styles affecting our overlay. `vite-plugin-css-injected-by-js` handles the minimal global CSS (index.css).

## Build and Deploy

`npm run build` → Vite builds `dist/nai-tag-builder.js` (IIFE).
Push to main → GitHub Actions: checkout → npm ci → npm run build → deploy dist/ to GitHub Pages.
