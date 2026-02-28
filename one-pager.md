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

### React Rendering on NovelAI Page
- NovelAI is a Next.js app with its own React 19 instance.
- Bundled React's async scheduler (MessageChannel-based) does not fire on this page. `createRoot().render()` creates the container but never flushes content.
- Fix: wrap `root.render()` in `flushSync()` from `react-dom` to force synchronous rendering. Confirmed working.

### Delivery Path
- Mobile OS clipboard has no standard UX for image paste — not viable.
- Bookmarklet as loader: injects external JS into NovelAI page.
- Chrome mobile cannot run userscripts/extensions — bookmarklet is the only injection method.
- localhost script injection from HTTPS page blocked by Chrome Private Network Access policy. Must serve from public HTTPS (GitHub Pages).
- GitHub Pages URL: `https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js`
- Chrome DevTools Snippets can paste and run large (210KB+) JS; Console cannot (truncation → SyntaxError).
- Cache-busting: bookmarklet URL must include `?v='+Date.now()` to bypass default GitHub Pages cache headers. Without this, mobile Chrome serves stale builds even after push.

### React `<input type="number">` Clamping Pattern
- Applying min/max clamping inside `onChange` (e.g. `clamp(Number(e.target.value), min, max)`) breaks single-digit deletion. `Number("")` → `0` → clamp forces back to min.
- Fix: allow empty strings during `onChange`. Apply clamping only in `onBlur`. State type: `number | string`.
- Same pattern applies to all numeric inputs (repeat interval, limits, steps, scale).

### CSS `resize` Limitations
- CSS `resize: both` on an element only provides a small drag handle at the bottom-right corner.
- Browser does not support edge-resize (dragging any border) via CSS alone.
- To achieve window-like edge resizing, a custom invisible `<div>` positioned absolutely on the desired edge with its own mousedown/touchstart drag handlers is required.

### CSS `fit-content` for Parent-Child Sizing
- `width: fit-content` on a parent makes it expand to match its largest child's intrinsic width.
- Useful when a resizable child (e.g. textarea with `resize: both`) needs to push the parent wider.
- Limitation: does not allow resizing the parent independently of the child.

---

## Bug Investigation

### Future Test
- Check auto generation mode to avoid the ban.
- NovelAI may disable Generate button when seed + all params are identical to previous generation. Auto-generate loop handles this by dispatching a fresh paste with incremented/randomized seed.

---

## Session Log

### v2.2 UX improvements and bug fixes

#### Overlay right-edge resize
- Custom invisible `<div>` (8px wide, `position: absolute`, `right: 0`, full height) acts as a drag handle.
- `mousedown`/`touchstart` on the handle starts tracking delta and updates `overlayWidth` state.
- `document.body.style.cursor = 'ew-resize'` during drag for visual feedback even when cursor leaves the handle.
- Minimum width 320px, maximum 90vw.
- Hidden when overlay is collapsed.

#### Slider controls for Steps and Scale
- `<input type="range">` paired with compact `<input type="number">` (48px wide).
- Label and number input placed in a flex row with `justify-content: space-between`.
- Slider uses `accentColor: theme.blue` for consistent theming.
- Number input uses the same `onBlur` clamping pattern as repeat interval inputs.