---
language: english
formatting:
  tables: false
  bold emphasis: false
  blockquotes: false
writing:
  preamble: false
  filler: false
  closing summary: false
  asides: false
---

# One-Pager

---

## Evergreen

### NovelAI Metadata Read Path (Paste)
- Observation: Web frontend reads tEXt chunks on paste. Confirmed by intercepting `1883-***.js` console output.
- Scope: Import modal trigger requires all 6 tEXt chunks — Title, Description, Software, Source, Generation time, Comment. A subset (e.g. Title + Software only, no Comment) shows the generic Image2Image / Vibe Transfer modal instead.
- Implication: pngEncoder must produce all 6 chunks. `Comment` key holds the JSON payload; minimum fields: `prompt`, `steps`, `scale`, `width`, `height`, `v4_prompt`. DataTransfer preserves PNG bytes exactly — no browser re-encoding (verified via byte-for-byte comparison with diagnose-paste.js).

### NovelAI Metadata Read Path (File Upload)
- Observation: File upload also reads tEXt chunks. Same `Comment` JSON format as paste.
- Scope: Python library (nai_meta.py) uses alpha LSB (stealth_pngcomp), but the web frontend uses tEXt only.

### stealth_pngcomp LSB Format
- Observation: Signature "stealth_pngcomp" (15 UTF-8 bytes = 120 bits) stored in alpha channel LSB.
- Scope: Layout — [signature 120 bits] [length 32 bits big-endian] [gzip payload]. Pixel order: column-major (x outer, y inner). One bit per pixel alpha LSB.
- Implication: Web frontend does not use this format for Import detection. Kept in current build as defense-in-depth.

### NovelAI V4 Metadata Structure
- Observation: Real JSON sample captured.
- Scope: Core structure — `v4_prompt.caption.base_caption` + `char_captions[]` + `v4_negative_prompt`. Wrapper fields (Software, Source, Description, Generation time) are tEXt-only, not in Comment JSON.

### NovelAI Page Environment
- Observation: No CSP header — external script injection is not blocked.
- Scope: body has 3 paste listeners, `div.ProseMirror` has 1. Listeners registered identically under mobile UA. Image page JS chunk: `1883-e81a1cb415362c52.js`.

### React Rendering on NovelAI Page
- Observation: NovelAI is a React 19 Next.js app. Bundled React's async MessageChannel scheduler does not fire on this page — `createRoot().render()` creates the container but never flushes content.
- Scope: Wrapping in `flushSync()` forces synchronous rendering. Confirmed working.
- Implication: React 19 controlled inputs revert values set via DOM manipulation (`nativeInputValueSetter` + synthetic events) — fiber reconciler overwrites immediately. Seed and other NAI input changes are only reliable through the paste pipeline. Direct DOM manipulation is fundamentally impossible.

### Delivery Path
- Observation: Mobile OS clipboard has no standard UX for image paste — not viable.
- Scope: Bookmarklet injects external JS into the NAI page. Chrome mobile cannot run userscripts/extensions — bookmarklet is the only injection method. localhost script injection from HTTPS pages is blocked by Chrome Private Network Access policy — must serve from public HTTPS (GitHub Pages).
- Implication: DevTools Snippets can run 210KB+ JS; Console cannot (truncation → SyntaxError). Cache-busting `?v='+Date.now()` is mandatory — GitHub Pages default cache headers cause mobile Chrome to serve stale builds even after push.

### React Number Input Clamping
- Observation: Applying min/max clamping inside `onChange` breaks single-digit deletion. `Number("")` → `0` → clamp forces back to min.
- Scope: Allow empty strings during `onChange`, apply clamping only in `onBlur`. State type: `number | string`.
- Implication: Same pattern applies to all numeric inputs (repeat interval, limits, steps, scale).

### CSS resize Limitations
- Observation: `resize: both` only provides a small drag handle at the bottom-right corner.
- Scope: Browser does not support edge-resize (dragging any border) via CSS alone.
- Implication: Window-like edge resizing requires a custom invisible `<div>` positioned absolutely on the desired edge with its own mousedown/touchstart drag handlers.

### CSS fit-content for Parent-Child Sizing
- Observation: `width: fit-content` on a parent makes it expand to match its largest child's intrinsic width.
- Scope: Useful when a resizable child (e.g. textarea with `resize: both`) needs to push the parent wider.
- Implication: Does not allow resizing the parent independently of the child.

### NovelAI Styled-Components Theming
- Observation: NovelAI does NOT use CSS custom properties. All theme colors are injected via Styled-Components with hashed class names. Any attempt to read CSS variables fails fundamentally.
- Scope:
  - `document.body.backgroundColor` is always `rgb(19, 21, 44)` regardless of theme — unreliable.
  - Background: `.image-gen-page` (main), `.image-gen-prompt-main` (prompt panel), `.settings-panel` (sidebar).
  - Text color: `.image-gen-page` computed `color`.
  - Label/header color: scraped from `label` elements.
  - Accent color: Generate button `backgroundColor`.
  - Input background: `textarea`, `input[type="text"]`.
  - Intensity colors: `<span>` elements with `low-intensity-color-*`, `mid-intensity-color-*`, `high-intensity-color-*` classes. Only exist when prompt contains weighted tags.
  - Fonts: Theme Editor exposes separate Header Font and Paragraph Font. `body.fontFamily` returns only one.
- Implication: Theme changes replace `<style>` tags in `<head>`. No class/attribute changes on `<html>`/`<body>`. Detect via `MutationObserver({ childList: true, subtree: true })` on `document.head`. NAI rapidly injects multiple style tags during theme change — 300ms debounce required.

### NAI Seed Zero Literal
- Observation: seed=0 in NAI is a literal fixed seed, NOT "use random". User-confirmed.
- Implication: Random rule must generate `Math.floor(Math.random() * 4294967295)`.

### NAI Identical Parameters Block
- Observation: "Identical parameters to last generation" error is a React state-level block that strictly disables the Generate `<button>`.
- Scope: Block happens before any network request — cannot be bypassed via `window.fetch` or WebSocket interception.
- Implication: The only bypass is changing a React state parameter (like Seed) so the button re-enables.

### NAI Mobile DOM Unmounting
- Observation: NAI responsive design unmounts the right-hand parameter panel (Seed, Steps, Guidance inputs) from the DOM entirely on narrow mobile screens.
- Implication: `querySelectorAll` and TreeWalker traversal fail 100%. Hidden elements cannot be manipulated.

### NAI Mobile UI Layout
- Observation: UI layout varies by viewport width. User-confirmed.
- Scope:
  - Narrow (<=375px): bottom-center `▲` toggles the prompt text area, NOT the parameter panel. Bottom-left `⚙️` opens the parameter panel (Steps, Guidance, Seed).
  - Medium (~850px, sidebar collapsed): `▲` is at the sidebar bottom next to the Sampler dropdown. Clicking expands the full parameter panel including Seed.
- Implication: The correct button depends entirely on viewport width. Crawler must try both `▲` and `⚙️` buttons.

### Automation vs Override Strategy
- Observation: Global Paste events (how the bookmarklet loads presets) overwrite the entire NAI prompt state.
- Scope: This violates user autonomy if the user is typing manually in the NAI interface. For autonomous operations like Seed +1/-1, direct DOM manipulation (`findNaiSeedInput`) is used instead.
- Implication: If DOM manipulation fails (e.g. mobile panel unmounted) and the Generate button is blocked, fallback heuristic searches for the Randomize (🎲) button and clicks it.

### Theme Global Mutable Pattern
- Observation: 9 components import `theme` from styles/theme.ts as a mutable global. `useDynamicTheme()` reassigns the global on every theme change AND triggers Context update, which cascades re-render to all children. Children then read the updated global value inline (e.g. `style={{ color: theme.text }}`). This works correctly. Shared style globals (`inputStyle`, `labelStyle`, `smallBtnStyle`) are also reassigned and work the same way.
- Scope: Only 3 module-level static constants are actual bugs — they capture theme values at module load time and never update: `miniBtn` (AutoGeneratePanel:29), `smallNumInput` (AutoGeneratePanel:22), `checkboxRowStyle` (AdvancedParams:11).
- Implication: Fix is moving 3 constants inside component functions. Full 9-component useTheme() migration is code quality improvement, not bug fix.

### Textarea Highlight Overlay Technique
- Observation: Transparent `<textarea>` layered over `<div aria-hidden="true">` with styled `<span>` elements achieves text highlighting without `contenteditable`.
- Scope: `intensityParser.ts` scores `[]` as negative (-1 per bracket) and `{}` as positive (+1 per bracket). `background-color: transparent !important` required to bypass NAI's aggressive inline CSS injection on textareas.

### NAI Comment JSON 44-Field Coverage
- Observation: NAI Comment JSON contains 44 fields total.
- Scope: 3 categories — 5 generation-affecting booleans/numbers (deliberate_euler_ancestral_bug, explike_fine_detail, minimize_sigma_inf, dynamic_thresholding_percentile, dynamic_thresholding_mimic_scale); 6 null-feature placeholders (director_reference_* 4, lora_* 2); 3 protocol fields (stream, signed_hash, extra_passthrough_testing).
- Implication: MetadataState stores 37 fields (generation 5 + null 6 + existing 26). Protocol 3 are hardcoded in buildCommentJson. signed_hash="" is accepted by NAI — no server validation on import.

### Dexie IndexedDB Load-Time Normalization
- Observation: Dexie `version().stores()` only manages indexes; does not auto-transform existing records. `JSON.parse()` + type assertion enforces nothing at runtime.
- Scope: When MetadataState schema changes (new fields, structural reorganization), existing records in IndexedDB lack new fields.
- Implication: `normalizeMetadataState({ ...DEFAULT, ...parsed })` at every load point (presetStorage, appState). No DB version bump needed. Also handles flat→nested migration by detecting `'basePrompt' in raw && !('prompt' in raw)`.

---

## Findings

### 2026-06-05 — UI/UX 리뉴얼 및 Glassmorphism
- Answers: 기존의 딱딱한 패널 구조에서 벗어나 `backdropFilter: 'blur(16px)'` 및 반투명 배경을 적용해 시각적 개방감을 높임. 스크롤바 커스텀 및 컴포넌트 여백 튜닝으로 모바일 터치 사용성 개선.

### 2026-03-13 — ImportModal Nested Merge Requirement
- Answers: `{ ...state, ...partial }` shallow merge replaces nested objects entirely. When ImportModal sends `partial.prompt` (subset of PromptState), the user's existing basePrompt is lost if unchecked. Fix: merge each group separately — `prompt: { ...state.prompt, ...partial.prompt }, params: { ...state.params, ...partial.params }, advanced: { ...state.advanced, ...partial.advanced }`.

### 2026-03-13 — Roadmap P1: TagEntry Schema Gap
- Answers: db.ts defines TagEntry (`keyword, category, weight, isEnabled, isNegative`) but it's never used. Current tags live as comma-separated text in `basePrompt` string with weight syntax (`1.5::tag::`). Missing fields for structured tag management: `order` (prompt position matters for NAI weighting) and `scope` ("base" vs "char_{id}" for character-specific tags). Category value taxonomy is undefined.

### 2026-03-01 (legacy) — Queue-driven Auto-generate Design
- Answers: Queue is `string[]` of preset IDs in React state (`useState`). Queue index tracked via `useRef` (not state) to avoid stale closure issues inside `setInterval`. Each interval tick: if queue non-empty, load next preset by ID, build CommentJson, dispatch paste. If empty, fall back to current editor state.
- Corrections: `queueIndexRef.current` resets to 0 on each new `handleApply`. Seed bumping uses the next preset's seed setting, not the editor's current seed.

### 2026-03-01 (legacy) — Preset Storage Architecture
- Answers: Each preset is a full `MetadataState` snapshot (~25 fields including character arrays) serialized as JSON. Stored as a JSON array under a single `localStorage` key (`nai-tb-presets`). ~2-4 KB per preset, well within the 5 MB cap.
- Corrections: `structuredClone(state)` required on save to break object references — prevents state mutation from affecting stored presets.

### 2026-02-28 (legacy) — Edge Resize Technique
- Answers: Invisible `<div>` (8px wide, `position: absolute`, `right: 0`, full height) acts as drag handle. `mousedown`/`touchstart` tracks delta and updates `overlayWidth` state. `document.body.style.cursor = 'ew-resize'` during drag for visual feedback even when cursor leaves the handle.
- Corrections: Minimum width 320px, maximum 90vw. Hidden when overlay is collapsed.
