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

Status: Core pipeline working. Paste path delivers metadata successfully. Ready for feature work.

## What Was Done This Session
- Resolved paste blocker. Root cause: tEXt chunk set was incomplete. NovelAI web frontend requires all 6 tEXt keys (Title, Description, Software, Source, Generation time, Comment) to trigger Import.
- Diagnostic scripts created and executed:
  - `scripts/diagnose-paste.js` — proved DataTransfer preserves PNG bytes (IDENTICAL).
  - `scripts/diagnose-paste-lsb.js` — proved LSB alone does not trigger Import on web frontend.
  - `scripts/inspect-nai-paste.js` — captured NovelAI's actual tEXt parsing from pasted images.
- Added stealth_pngcomp LSB encoding to PNG (defense-in-depth, alongside tEXt).
- Verified end-to-end: bookmarklet inject → overlay → "Apply" → paste → Import modal → prompt populated → image generated matching prompt.

## Current State
- `src/App.tsx` generates a PNG with both tEXt chunks (6 keys) and alpha LSB (stealth_pngcomp).
- `dist/nai-tag-builder.js` built and tested on desktop Chrome (mobile emulation). Not yet tested on actual mobile Kiwi browser.
- Diagnostic scripts in `scripts/` can be archived or deleted.

## Next
1. Test on actual mobile Kiwi browser to confirm end-to-end.
2. Feature work: multi-character preset support (char_captions), negative prompt, tag builder UI.
3. Host on GitHub Pages for bookmarklet delivery.