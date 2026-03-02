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

### NovelAI Styled-Components Theming
- NovelAI does NOT use CSS custom properties (variables like `--bg-color`) for theming.
- All theme colors are injected via Styled-Components with hashed class names (e.g. `sc-a5f...`, `sc-9882ac77-0`).
- `document.body.backgroundColor` always stays `rgb(19, 21, 44)` regardless of active theme. It is NOT the themed background.
- Real themed background is on `.image-gen-page`. Panel background is on `.image-gen-prompt-main` or `.settings-panel`.
- When the user switches themes, Styled-Components replaces `<style>` tags in `<head>`. No class/attribute changes on `<html>` or `<body>`.
- To detect theme changes in real time, observe `document.head` with `MutationObserver({ childList: true, subtree: true })`.
- Intensity colors are applied to `<span>` elements with class names matching `low-intensity-color-*`, `mid-intensity-color-*`, `high-intensity-color-*`. These spans only exist when the prompt area contains weighted tags.
- Theme Editor exposes separate Header Font and Paragraph Font. `body.fontFamily` only returns one of them.

---

## Bug Investigation

### Seed Injection Failure — RESOLVED
Root cause: React 19 controlled inputs revert values set via DOM manipulation. `nativeInputValueSetter` + synthetic events are overwritten by React's fiber reconciler.
Resolution: abandoned DOM Seed manipulation entirely. All seed changes now go through the PNG metadata paste pipeline (`pngEncoder.ts` → `pasteDispatch.ts`). `random` rule generates `Math.floor(Math.random() * 4294967295)` per loop.

### Theme Color Mismatch — RESOLVED
Symptom: Tag Builder displayed hardcoded dark navy theme instead of matching NovelAI's active theme (e.g. Sand, Ink, Slate).
Root cause: initial code attempted to read CSS variables from `:root`/`body`. NovelAI uses Styled-Components with no CSS variables.
Resolution: switched to direct DOM computed style scraping from `.image-gen-page`, `.image-gen-prompt-main`, `.settings-panel`, and Generate button. Added `MutationObserver` on `document.head` for real-time sync.
Known weakness: `isVeryDark` uses hardcoded RGB string comparison instead of luminance calculation. Intensity color scraping depends on prompt content.

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

### v2.3 Preset Progression, Rotation, Randomization

#### localStorage preset storage
- Each preset is a full `MetadataState` snapshot (all ~25 fields including character arrays) serialized as JSON.
- Stored as a JSON array under a single key (`nai-tb-presets`) in `localStorage`. Simple and sufficient — each preset is ~2-4 KB, well within the 5 MB cap.
- `structuredClone(state)` used on save to break all object references; prevents state mutation from affecting stored presets.

#### Queue-driven auto-generate loop
- Queue is `string[]` of preset IDs stored in React state (`useState`). Queue index tracked in a `useRef` (not state) to avoid stale closure issues inside `setInterval`.
- On each interval tick: if queue is non-empty, load the next preset from localStorage by ID, build CommentJson from it, dispatch the paste. If queue is empty, fall back to current editor state.
- `queueIndexRef.current` resets to 0 on each new `handleApply` call to restart the cycle from the beginning.
- Seed bumping logic (for bypassing disabled Generate button) uses the next preset's seed setting, not the editor's current seed.

### v2.4 Auto-Generate Live Loop & Mobile UI Limitations

#### React DOM Unmounting on Mobile
- NovelAI's responsive design unmounts the right-hand parameter panel (including Seed, Steps, Guidance inputs) when closed on narrow mobile screens.
- Elements are removed from the DOM, making any `querySelectorAll` or TreeWalker DOM traversal fail 100%. Hidden elements cannot be manipulated.

#### Identical Parameters UI Block
- The "Identical parameters to last generation" error is a React state-level block that strictly disables the "Generate" `<button>`.
- Because the block happens *before* any network request is created, it cannot be bypassed by intercepting `window.fetch` or WebSocket connections.
- The ONLY way to bypass it natively is to change a React state parameter (like Seed) so the button re-enables itself.

#### Robust React Input Manipulation
- Finding specific inputs (like Seed) in a compiled Next.js app is fragile. IDs/Names are often missing.
- *Robust Heuristic:* Walk the DOM to find any text node matching "Seed" (or the localized equivalent), then traverse up to 5 parent levels and search all siblings for an `<input>`.
- *Triggering React State:* Modifying `input.value` is not enough. To force React's synthetic event system to register the change, you must:
  1. `input.focus()`
  2. Call `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, newValue)`
  3. Dispatch `input`, `change`, `keydown`, `keyup` events consecutively.
  4. `input.blur()`
- STATUS: this sequence is NOT confirmed working on NovelAI. Pending debug log analysis.

#### Non-Interfering Automation vs. Complete Override
- Global `Paste` events (how the bookmarklet loads full presets) overwrite the entire NAI prompt state. This violates user autonomy if the user is typing manually into the NAI interface.
- To provide Seed Increment/Decrement (+1/-1) autonomously, we use direct DOM manipulation (`findNaiSeedInput`).
- If DOM modification fails (e.g. mobile panel unmounted) and the Generate button is blocked, a fallback heuristic searches for a "Randomize" (🎲) button and clicks it to bypass the block.

#### NovelAI Mobile UI Layout (User-Confirmed)
- Narrow viewport (<=375px): `▲` button at bottom center toggles the main prompt text area, NOT the parameter panel. The `⚙️` gear icon at bottom-left opens the parameter panel (Steps, Guidance, Seed).
- Medium viewport (~850px desktop with sidebar collapsed): `▲` button is at the bottom of the sidebar column, next to the Sampler dropdown. Clicking it expands the full parameter panel including Seed.
- The correct button to click depends entirely on viewport width. The crawler must try both `▲` and `⚙️`-style buttons.

#### Seed value 0 is NOT random
- Previously assumed NAI treats seed=0 as "use random". User confirmed this is false: NAI uses 0 as a literal fixed seed.
- Corrected to generate `Math.floor(Math.random() * 4294967295)` when the Random rule is active.

### v2.5 Dynamic Theme Sync

#### DOM Computed Style Scraping
- `document.body.backgroundColor` is always `rgb(19, 21, 44)` regardless of theme. Unreliable as theme source.
- Correct targets: `.image-gen-page` (main background), `.image-gen-prompt-main` (prompt panel), `.settings-panel` (sidebar), `textarea` / `input[type="text"]` (input background).
- Text color scraped from `.image-gen-page` computed `color`. Header/label color scraped from `label` elements.
- Generate button `backgroundColor` used as accent/action color.

#### Real-Time Theme Observer
- Styled-Components replaces `<style>` tags in `<head>` on theme change. No class or attribute changes on `<html>`/`<body>`.
- `MutationObserver` on `document.head` with `{ childList: true, subtree: true }` catches these style replacements.
- 300ms debounce prevents excessive `updateTheme()` calls during rapid style injection.
- Initial theme load uses `setTimeout(updateTheme, 100)` to allow DOM to settle after bookmarklet injection.

#### isVeryDark Heuristic
- Current implementation compares `mainBg` against a whitelist of known dark RGB strings: `rgb(0, 0, 0)`, `rgb(19, 21, 44)`, `rgb(11, 12, 26)`, `rgb(37, 41, 49)`.
- Fragile: any theme with a background color not in the whitelist defaults to light-mode styling.
- Future improvement: parse RGB values and calculate relative luminance (`(0.299*R + 0.587*G + 0.114*B) / 255 < 0.5`).

#### Intensity Color Scraping
- NovelAI assigns `low-intensity-color-*`, `mid-intensity-color-*`, `high-intensity-color-*` classes to `<span>` elements in the prompt editor.
- These spans only exist when weighted tags are visible in the prompt. Empty prompt → no spans → fallback defaults used.
- Fallback defaults: Low=`rgba(4, 102, 206, 0.3)`, Mid=`rgba(0, 151, 7, 0.5)`, High=`rgba(184, 55, 0, 0.5)`.