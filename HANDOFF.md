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
Status: v2.2 deployed to GitHub Pages. All v2.1 pending verifications cleared by user on mobile. New UX features confirmed working on desktop.

## What Was Done This Session
- Cache-busting: bookmarklet URL now appends `?v='+Date.now()` to bypass stale mobile cache without manual clearing.
- Number input clamping fix: moved `clamp` logic from `onChange` to `onBlur` so backspace works naturally on all numeric inputs (repeat interval, min/max limits).
- Slider (gauge bar) controls: Steps and Scale now have `<input type="range">` sliders alongside compact number inputs for easier mobile adjustment.
- Prompt textarea resize: users can drag the bottom edge to adjust height (`resize: vertical`).
- Overlay window resize: custom right-edge drag handle allows resizing the entire overlay width. Minimum 320px, maximum 90vw. Uses `position: absolute` invisible 8px-wide handle on the right edge with `cursor: ew-resize`.
- Seed duplication fix in auto-generate loop: when Generate button is disabled (identical seed + params), the loop now dispatches a fresh paste with incremented seed (fixed seed) or re-randomized seed (seed=0) to bypass the block.

## Current State
- Source: 16 TypeScript files under `src/`.
- Build: `npm run build` → `dist/nai-tag-builder.js` (~216KB, gzip ~67KB).
- Deploy: push to main → GitHub Actions builds → GitHub Pages serves.
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Bookmarklet URL: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?v='+Date.now()})))`

## Pending Verification
- Overlay right-edge resize: confirmed on desktop, not yet tested on mobile touch.
- Slider controls (Steps/Scale): confirmed on desktop, not yet tested on mobile touch.
- Seed duplication fix: logic implemented but not yet tested in a real auto-generate session.

## Next
1. Feature work: preset save/load (localStorage), Danbooru tag autocomplete, character preset library.
2. DB Import/Export for presets.
3. Default values: set bookmarklet default prompt/settings to match user's actual NovelAI workflow.
4. UX: make prompt and settings manipulation more user-friendly.
