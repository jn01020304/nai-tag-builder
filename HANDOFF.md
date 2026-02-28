---
language: english
formatting:
  tables: false
  bold_emphasis: false
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# Handoff
Status: v2.3 built locally. Preset Progression, Rotation, Randomization, and Import/Export implementation complete. Not yet deployed.

## What Was Done This Session
- Preset data model: `Preset` interface and `QueueMode` type in `src/types/preset.ts`.
- Preset storage layer: localStorage CRUD utility in `src/model/presetStorage.ts` (save, load, delete, reorder, get-by-id).
- LOAD_PRESET reducer action: added to `useMetadataState.ts` to replace entire editor state with a saved preset.
- PresetManager UI component: collapsible section with save-by-name input, preset list (load/queue/delete per item), queue chip display with reorder arrows, and Progression/Random mode selector.
- Auto-generate loop integration: `App.tsx` now holds queue state (`queue`, `queueMode`, `queueIndexRef`). When queue is non-empty, each loop iteration pulls the next preset from the queue (sequential or random) and dispatches it with seed bumping.
- Preset Import/Export: `exportPresets()` serializes all presets to JSON for download, `importPresets()` reads a JSON file and merges new presets (skipping duplicate IDs). 📥 Import / 📤 Export buttons added to PresetManager UI.

## Current State
- Source: 19 TypeScript files under `src/`.
- Build: `npm run build` → `dist/nai-tag-builder.js` (~222KB, gzip ~69KB).
- Deploy: push to main → GitHub Actions builds → GitHub Pages serves.
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Bookmarklet URL: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?v='+Date.now()})))`

## Pending Verification
- Preset save/load/delete: not yet tested on the live NovelAI page.
- Auto-generate with queued presets: Progression and Random modes not yet tested end-to-end.
- Mobile touch on new PresetManager UI elements.
- Overlay right-edge resize: confirmed on desktop, not yet tested on mobile touch.
- Slider controls (Steps/Scale): confirmed on desktop, not yet tested on mobile touch.
- Preset Import/Export: not yet tested on the live NovelAI page.

## Next
1. Commit and push to deploy v2.3 to GitHub Pages.
2. Default values: set bookmarklet default prompt/settings to match user's actual NovelAI workflow.
3. UX: make prompt and settings manipulation more user-friendly.

