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

# Changelog

## v2.1 (2026-02-27)
Mobile verification + UX overhaul.
- Mobile end-to-end verified on Samsung Galaxy (Chrome). Bookmarklet → overlay → Apply → Import → Generate → image created.
- Auto-import: paste dispatch now auto-clicks "Import Metadata" and scrolls to Generate button. No manual modal interaction needed.
- Optional auto-generate: "적용 후 자동 생성" checkbox auto-clicks Generate button after import. Repeat mode generates every N seconds (configurable, default 30s, clamp 3~1800s).
- Overlay collapse (▼/▲): minimize to header-only strip. Apply button collapses instead of closing.
- Drag to reposition: header acts as drag handle (mouse + touch). `touchAction: 'none'` for mobile.
- Overlay reopen: close (✕) removes container from DOM so bookmarklet can recreate it without page refresh.
- Fixed: overlay at `bottom: 20px` covered Generate button on mobile → moved to `top: 20px`.
- Fixed: index.css global styles (`body`, `button`, `a`) leaked into NovelAI page → removed import.
- Fixed: `isApplying` stuck true after successful Apply → moved reset to `finally` block.

## v2.0 (2026-02-27)
- Refactored monolithic App.tsx into modular architecture (types, model, encoding, hooks, components, styles).
- Full NovelAI V4 metadata support: multi-character presets (char_captions), negative prompt, all generation parameters.
- UI: collapsible sections for Parameters (default open), Characters, Negative Prompt, Advanced. Dimension presets (Portrait/Landscape/Square). Sampler and noise schedule dropdowns.
- Fixed React rendering on NovelAI page: flushSync() to bypass scheduler conflict with host page React.
- GitHub Pages deployment via GitHub Actions. Bookmarklet now loads from public HTTPS URL.

## v1.2
- Added stealth_pngcomp LSB encoding (defense-in-depth alongside tEXt).
- Fixed Import modal trigger: all 6 tEXt chunks required (Title, Description, Software, Source, Generation time, Comment).
- Verified end-to-end paste pipeline on desktop Chrome.

## v1.0
- Initial implementation. Single textarea for prompt, Apply button, PNG generation with tEXt chunks.
