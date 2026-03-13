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

---

## Findings

### 2026-03-13 — D2 Nested Migration: Missed Files Discovery
- Answers: D2 flat→nested restructuring touched 8 files (~90 accesses). Two files (PresetManager.tsx, useAutoGenerator.ts) were missed because they access MetadataState indirectly — PresetManager reads from translateNovelAiMetadata return value, useAutoGenerator reads from stateRef. Neither was in the initial impact analysis (2.md). Discovered only when tsc was run post-D2. Lesson: always run full tsc after structural refactoring, even when impact analysis seems complete.

### 2026-03-13 — isVeryDark BT.601 Luminance Formula
- Answers: BT.601 weighted luminance `(0.299*R + 0.587*G + 0.114*B) / 255` replaces hardcoded 5-RGB-string whitelist. Threshold 0.5 (dark below, light above). Fallback on regex parse failure: `true` (assume dark). Handles all `rgb()` and `rgba()` format strings from `getComputedStyle`.

### 2026-03-13 — useEdgeResize Hook Extraction Pattern
- Answers: Resize logic extracted from App.tsx to `useEdgeResize(minWidth)`. Returns `{ overlayWidth, startResize }`. The `startResize` closure captures `overlayWidth` at call time into `startWidth` — this is intentional (drag starts from current width). React useState value is stale in the closure but only the initial capture matters for delta calculation.

### 2026-03-13 — MetadataState Restructuring Impact
- Answers: Flat→nested restructuring affects ~90 field access patterns across 8 files. Critical: buildCommentJson (23 accesses), metadataTranslator (22), GenerationParams (16), AdvancedParams (13), ImportModal (17), useMetadataState (12+). SET_FIELD dispatch pattern needs redesign. D2 must not be combined with R3 (data loss fix) — different urgency, atomic verification impossible if combined.

### 2026-03-13 — Dexie IndexedDB Migration Strategy
- Answers: Dexie `version().stores()` only manages indexes; does not auto-transform existing records. `JSON.parse()` of old data missing new fields succeeds but returns incomplete objects — `as MetadataState` assertion enforces nothing at runtime. Load-time normalization (`{ ...DEFAULT_STATE, ...partial }`) is preferred over Dexie upgrade hooks: matches existing `migrateOldLocalStorage()` pattern, no DB version bump, handles both PresetEntry.settings and StateEntry.stateJson.

### 2026-03-13 — N차 의사결정: Code Work Adaptation
- Corrections: Starting from a technical audit (listing code problems) is not 탐색. 탐색 starts from user intent and pain points, identifies components collaboratively. Simple investigations (grep, code search) must not be deferred to 심화 — do them immediately. Decision rounds must produce tentative decisions, not open questions for the user.
- Answers: The decision-making process needs 4 adaptations for code work: (1) dependency mapping in 탐색, (2) [internal]/[external] breaking change tags, (3) verification criteria in 심화, (4) test co-creation in 구현. The base flow (탐색→심화→구현→확장) remains valid.

### 2026-03-13 — D1+R3+R4 Roundtrip Verification (Live)
- Answers: After D1 (use_coords/use_order parsing), R3 (14 field coverage), R4 (normalizeMetadataState), deployed build passes live NAI site test. PNG drag-and-drop → ImportModal → NAI paste pipeline: NAI internal JS (`1883-*.js`) accepts the rebuilt Comment JSON with signed_hash="" and hardcoded extra_passthrough_testing without rejection. All 44 Comment JSON keys are parsed. NAI UI correctly reflects imported values (Steps, Guidance, Seed, Sampler, Noise, Resolution, CFG Rescale). Roundtrip test: 0 DIFF (signed_hash excluded as server-generated).
- Corrections: ImportModal.handleApply was missing 13 fields in the importSettings branch (11 R3 + 2 D1: useCoords/useOrder). Fixed before deployment.

### 2026-03-13 — NAI Comment JSON Field Coverage
- Answers: NAI Comment JSON contains 44 fields. MetadataState covers 26 (59%). 14 unmapped fields classified: 5 generation-affecting (deliberate_euler_ancestral_bug, explike_fine_detail, minimize_sigma_inf, dynamic_thresholding_percentile, dynamic_thresholding_mimic_scale) → add to MetadataState+UI; 6 null features (director_reference_* 4, lora_* 2) → add to MetadataState, no UI; 3 protocol (stream, signed_hash, extra_passthrough_testing) → hardcode in buildCommentJson. Additionally, metadataTranslator does not parse v4_prompt.use_coords/use_order — they fall back to DEFAULT_STATE values.
- Corrections: Previous HANDOFF claimed buildCommentJson.ts "completely omits v4_prompt" — actually v4_prompt is present. The real bug is field coverage and translator parsing gaps, not structural omission.

### 2026-03-01 (legacy) — Queue-driven Auto-generate Design
- Answers: Queue is `string[]` of preset IDs in React state (`useState`). Queue index tracked via `useRef` (not state) to avoid stale closure issues inside `setInterval`. Each interval tick: if queue non-empty, load next preset by ID, build CommentJson, dispatch paste. If empty, fall back to current editor state.
- Corrections: `queueIndexRef.current` resets to 0 on each new `handleApply`. Seed bumping uses the next preset's seed setting, not the editor's current seed.

### 2026-03-01 (legacy) — Preset Storage Architecture
- Answers: Each preset is a full `MetadataState` snapshot (~25 fields including character arrays) serialized as JSON. Stored as a JSON array under a single `localStorage` key (`nai-tb-presets`). ~2-4 KB per preset, well within the 5 MB cap.
- Corrections: `structuredClone(state)` required on save to break object references — prevents state mutation from affecting stored presets.

### 2026-02-28 (legacy) — Edge Resize Technique
- Answers: Invisible `<div>` (8px wide, `position: absolute`, `right: 0`, full height) acts as drag handle. `mousedown`/`touchstart` tracks delta and updates `overlayWidth` state. `document.body.style.cursor = 'ew-resize'` during drag for visual feedback even when cursor leaves the handle.
- Corrections: Minimum width 320px, maximum 90vw. Hidden when overlay is collapsed.
