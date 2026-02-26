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
