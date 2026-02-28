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

---

## Bug Investigation

### Future Test
- Check auto generation mode to avoid the ban.

---

## Session Log

### v2.1 mobile verification and UX

#### Mobile Chrome bookmarklet execution
- Bookmarklet cannot be dragged on mobile. Must: bookmark any page → edit bookmark URL to `javascript:void(...)`.
- To run: type bookmark name in address bar → tap the ★ icon item in dropdown. Pressing Enter triggers a Google search instead.
- Generic names like "test" get buried by search suggestions. Use unique names like "nai-tag".
- Alternative: Chrome menu (⋮) → Bookmarks → tap the bookmarklet directly.

#### NovelAI DOM selectors
- Styled-components class names (`sc-2f2fb315-0`, etc.) are hashed per build — never use them as selectors.
- Use `textContent` matching: `b.textContent?.trim() === 'Import Metadata'`, `b.textContent?.includes('Generate')`.
- 45+ buttons on the page. The ▼ panel collapse toggle is NOT a `<button>` — may be a div or SVG.

#### Overlay positioning on mobile
- `position: fixed; bottom: 20px` covers NovelAI's Generate button (also at screen bottom).
- Fix: `top: 20px`. Overlay at top, Generate button at bottom — no conflict.

#### Global CSS leak from Vite defaults
- Default `index.css` has global rules: `body { display: flex; min-height: 100vh }`, `button { border-radius: 8px; background-color: #1a1a1a }`.
- These override NovelAI's own styles — can hide buttons or break layout.
- Fix: remove `import './index.css'` from main.tsx. All overlay styles use inline React styles via theme.ts.

#### Bookmarklet re-entry after close
- `setIsVisible(false)` → React returns null but container div remains in DOM.
- Next bookmarklet invocation: `document.getElementById(CONTAINER_ID)` finds the empty div → skips creation → nothing happens.
- Fix: `document.getElementById(CONTAINER_ID)?.remove()` on close. Full DOM removal lets bookmarklet recreate from scratch.

#### Mobile touch drag
- `onTouchStart` via React is passive by default in Chrome — browser claims the gesture for scrolling.
- CSS `touchAction: 'none'` on the drag handle is required. Tells browser to not handle any touch gestures on that element.
- Must also add `touchmove` listener to `document` with `{ passive: false }` and call `e.preventDefault()`.
- Use `(e.target as Element).closest('button')` check to skip drag when tapping header buttons.

#### Paste side effect: blank PNG in image panel
- Dispatching paste event with a PNG makes NovelAI add the image to its history/display panel.
- On mobile, the image panel expands → pushes Generate button below fold.
- Not a bug in our code — side effect of the paste-based injection method.
- Mitigated by auto-clicking Import Metadata + scrolling to Generate button after import.

#### Browser cache on mobile
- GitHub Pages serves script with default cache headers.
- After pushing a new build, users must clear mobile Chrome cache to see changes.
- Path: Settings → Privacy → Clear browsing data → Cached images and files.
- Fix: cache-busting query param (`?v=timestamp`) added to bookmarklet URL.

#### React Input Clamping Issue
- When using `onChange` with a clamping function (e.g. `clamp(Number(e.target.value), min, max)`), a user trying to backspace the number '3' creates an empty string.
- This empty string is cast to `0`, which is below the minimum limit, so `clamp` instantly forces the input back to `3`, preventing deletion.
- Fix: Allow empty strings during `onChange` state updates (e.g. typing), and move the clamping logic strictly to the `onBlur` event handler.