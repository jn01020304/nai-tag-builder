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
Status: v2.1 deployed to GitHub Pages. Mobile end-to-end verified on Samsung Galaxy (Chrome). Auto-import, drag, collapse, repeat-generate all working.

## What Was Done This Session
- Mobile real-device testing: bookmarklet installation, execution, full end-to-end flow confirmed.
- Overlay UX: drag to reposition (mouse + touch), collapse/expand (▼/▲), close removes DOM for clean re-entry.
- Auto-import: paste dispatch auto-clicks Import Metadata, scrolls to Generate button.
- Auto-generate: optional checkbox auto-clicks Generate after import. Repeat mode generates every N seconds (configurable interval with min/max limits).
- Bug fixes: overlay position (bottom → top), index.css global style leak removed, isApplying reset, bookmarklet re-entry after close.
- Number Input Clamping Fix: `onChange` clamping bug fixed by pushing clamping behavior to `onBlur`, allowing users to delete numbers freely.
- Cache-busting: added dynamic parameter to the bookmarklet URL (`?v=timestamp`) to bypass mobile Chrome cache issues instantly.

## Current State
- Source: 16 TypeScript files under `src/`.
- Build: `npm run build` → `dist/nai-tag-builder.js` (213KB, gzip 66KB).
- Deploy: push to main → GitHub Actions builds → GitHub Pages serves.
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Bookmarklet URL: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?v='+Date.now()})))`

## Pending Verification
- (All previous pending verifications cleared by user confirmation.)

## Next
1. UI improvements: use slider (gauge bar) controls for numeric generation settings like Steps and Scale.
2. Seed Generation: handle identical seeds in repeat mode (e.g., randomize seed on each generation or set to 0).
3. Feature work: preset save/load (localStorage), Danbooru tag autocomplete, character preset library.
