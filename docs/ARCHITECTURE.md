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

## Objective
Enable end-to-end prompt and setting workflows within the NovelAI mobile site to eliminate external screen switching.

## Planned Solutions
1. Full Presets: Ready-to-use configurations for immediate image generation.
2. Category Presets: Modular selection and combination of elements (outfits, backgrounds, etc.).
3. Tag Auto-Complete: Suggested tags during prompt entry (Benchmark: `@ref-googleExtension\danbooru-auto-complete`).

---

## Injection Mechanism
```
Bookmarklet (user tap)
  → <script src="...github.io/nai-tag-builder.js">
    → main.tsx creates fixed-position container div
      → ReactDOM.createRoot + flushSync renders <App/>
```

- Bookmarklet loads the bundled JS from GitHub Pages into the NovelAI page.
- `flushSync()` is required because NovelAI's own React 19 scheduler conflicts with our bundled React's async MessageChannel scheduler. Without it, createRoot().render() silently produces empty DOM.
- Container: `position: fixed; top: 20px; right: 20px; z-index: 999999`. Bottom positioning is avoided because NovelAI's Generate button is fixed at the bottom on mobile.
- No `index.css` import — global CSS leaks into the host page and breaks NovelAI's own button/body styles. All styling uses inline React styles via `theme.ts`.

## Module Structure
```
src/
├── main.tsx                    Entry point. DOM container + React mount.
├── App.tsx                     Root component. Overlay shell, drag, collapse, auto-generate loop.
│
├── types/metadata.ts           NovelAI V4 Comment JSON TypeScript types.
├── model/
│   ├── defaults.ts             Default values for all ~25 metadata fields.
│   └── buildCommentJson.ts     UI state → Comment JSON transform.
│
├── encoding/
│   ├── pngEncoder.ts           PNG generation: tEXt chunks + stealth_pngcomp LSB encoding.
│   └── pasteDispatch.ts        Paste event dispatch + post-paste automation (auto-import, auto-generate).
│
├── hooks/
│   └── useMetadataState.ts     useReducer central state for all metadata fields.
│
├── components/
│   ├── PromptSection.tsx        Base prompt textarea.
│   ├── GenerationParams.tsx     Width/height/steps/scale/sampler/noise/seed.
│   ├── CharacterCaptions.tsx    Multi-character entries with x/y center coords.
│   ├── NegativePrompt.tsx       Negative base + per-character captions.
│   ├── AdvancedParams.tsx       CFG rescale, SMEA, dynamic thresholding, etc.
│   ├── CollapsibleSection.tsx   Reusable ▶/▼ collapsible wrapper.
│   └── ApplyButton.tsx          Apply button with loading state.
│
└── styles/theme.ts             Catppuccin Mocha palette + shared input/label/button styles.
```

## Data Flow
```
User input
  → useMetadataState (useReducer)
    → buildCommentJson(state) → Comment JSON object
      → pngEncoder: tEXt chunks + LSB stealth encoding → PNG Blob
        → pasteDispatch: ClipboardEvent('paste') to .ProseMirror
          → autoImportAndScroll:
              waitFor("Import Metadata" button) → click
              waitFor(modal closes) → scroll/click Generate
```

## Overlay Lifecycle
```
Bookmarklet tap
  → Container div created, React mounts <App/>
    → User fills fields, taps Apply
      → PNG generated, paste dispatched
      → Overlay collapses to header strip (not removed)
      → Auto-import runs in background
    → User can expand (▲) to edit and re-apply
    → User taps ✕
      → stopLoop() (if auto-generate active)
      → Container div removed from DOM entirely
        → Next bookmarklet tap recreates from scratch
```

## Overlay UX
- Drag: header acts as drag handle. Mouse (mousedown/move/up) + touch (touchstart/move/end). `touchAction: 'none'` on header prevents browser scroll interception. On first drag, position switches from `right`-based to `left`-based.
- Collapse: ▼/▲ toggle hides/shows body. Apply triggers collapse (not removal).
- Close: ✕ removes the container div from DOM. Clears any active auto-generate loop.
- Auto-generate loop: `setInterval` clicks Generate every N seconds. Stop button (■) visible in collapsed header. Interval clamped between configurable min (default 3s) and max (default 1800s).

## Encoding Pipeline
Two parallel encoding methods in pngEncoder.ts, both embedded in the same PNG:

1. tEXt chunks (primary): 6 chunks inserted after IHDR — `Title`, `Description`, `Software`, `Source`, `Generation time`, `Comment`. NovelAI reads these on paste to trigger the Import modal.

2. stealth_pngcomp LSB (defense-in-depth): gzip-compressed JSON embedded in alpha channel LSBs, column-major order. Signature: "stealth_pngcomp" (120 bits). Not used by NovelAI's web frontend for import detection, but kept for compatibility with Python tools.

## Appendix: NovelAI V4 Comment JSON Reference
Captured from a real 2-character generation. This is the `Comment` tEXt chunk payload.

Key structures:
- `v4_prompt.caption.base_caption` — shared prompt
- `v4_prompt.caption.char_captions[]` — per-character prompts with `centers[].x/y`
- `v4_negative_prompt` — same structure for negative
- Top-level `prompt` and `uc` — duplicates of base_caption / negative base_caption

See `⏳History.md` lines 489-557 for the full captured JSON sample.
