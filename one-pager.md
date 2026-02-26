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

# One-Pager
Session bug log and working notes. Reset on phase transition; keep Evergreen Notes.

---

## Evergreen Notes

### NovelAI Metadata Read Path (Paste)
- Web frontend reads tEXt chunks on paste. Confirmed by intercepting `1883-***.js` console output.
- Import modal trigger requires all 6 tEXt chunks: `Title`, `Description`, `Software`, `Source`, `Generation time`, `Comment`.
  - Subset (e.g. Title + Software only, no Comment) → generic image modal (Image2Image / Vibe Transfer), not Import.
- `Comment` key holds the JSON payload. Minimum fields: `prompt`, `steps`, `scale`, `width`, `height`, `v4_prompt`.
- DataTransfer preserves PNG bytes exactly — no browser re-encoding. Verified by byte-for-byte comparison (diagnose-paste.js).

### NovelAI Metadata Read Path (File Upload)
- File upload also reads tEXt chunks. Same `Comment` JSON format.
- Python library (nai_meta.py) uses alpha LSB (stealth_pngcomp), but web frontend uses tEXt.

### stealth_pngcomp LSB Format
- Signature: "stealth_pngcomp" (15 UTF-8 bytes = 120 bits) in alpha LSB.
- Layout: [signature 120 bits] [length 32 bits big-endian] [gzip payload].
- Pixel order: column-major (x outer, y inner). One bit per pixel alpha LSB.
- Web frontend does not use this for Import detection. Kept in current build as defense-in-depth.

### NovelAI V4 Metadata Structure
- Real JSON sample captured (see ⏳History.md lines 489-557).
- Core structure: `v4_prompt.caption.base_caption` + `char_captions[]` + `v4_negative_prompt`.
- Wrapper fields (`Software`, `Source`, `Description`, `Generation time`) are tEXt-only, not in Comment JSON.

### NovelAI Page Environment
- No CSP header — external script injection is not blocked.
- body has 3 paste listeners, `div.ProseMirror` has 1 paste listener.
- Listeners are registered identically under mobile UA.
- Image page JS chunk: `1883-e81a1cb415362c52.js` (lines 226, 1) logs parsed tEXt metadata on paste.

### Delivery Path
- Mobile OS clipboard has no standard UX for image paste — not viable.
- Bookmarklet as loader: injects external JS into NovelAI page.
- Chrome mobile cannot run userscripts/extensions — bookmarklet is the only injection method.

---

## Bug Investigation

---

## Session Log

### Paste blocker investigation
- diagnose-paste.js: DataTransfer preserves PNG bytes (IDENTICAL). Hypothesis 1 (browser re-encoding) eliminated.
- diagnose-paste-lsb.js: LSB-only PNG → self-check PASS, alpha LSB MATCH, but no modal at all. NovelAI web frontend does not detect stealth_pngcomp signature.
- tEXt (Title + Software only, no Comment) + LSB → generic image modal, not Import.
- inspect-nai-paste.js: pasting real NovelAI image logs full tEXt object from `1883-***.js`. Web frontend reads tEXt on paste.
- Root cause: previous tEXt set was missing `Source` and `Generation time` chunks. Adding all 6 chunks → Import succeeds, prompt populated, image generated correctly.