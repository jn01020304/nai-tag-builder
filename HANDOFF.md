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

## Current State
- Source: 16 TypeScript files under `src/`.
- Build: `npm run build` → `dist/nai-tag-builder.js` (213KB, gzip 66KB).
- Deploy: push to main → GitHub Actions builds → GitHub Pages serves.
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Bookmarklet URL: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?v='+Date.now()})))`

## Pending Verification
- Drag: not yet confirmed working on mobile (touchAction: none deployed but user hasn't tested latest build with cache cleared). → Clear
- Collapse button (▼): not yet confirmed visible on mobile (may be obscured by host-page CSS). → Clear
- Repeat auto-generate: not yet tested on mobile.

## Next
1. Verify pending items above on mobile (cache cleared).
~~2. Cache-busting: add `?v=timestamp` or hash param to bookmarklet script URL to avoid stale cache issues.~~ (Done)
3. Feature work: preset save/load (localStorage), Danbooru tag autocomplete, character preset library.
