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

## v3.0 (2026-06-05)
UI/UX 전면 개편 및 Glassmorphism 적용.
- **Glassmorphism:** App 최상위 레이아웃, 오버레이 헤더/푸터에 반투명 효과 및 블러 적용.
- **시각적 계층 구조 강화:** Inter 폰트 강제 적용, 커스텀 스크롤바 튜닝.
- **사용성 개선:** PresetManager 큐 칩 둥근 알약(Pill) 형태로 개선, HighlightedTextarea 포커스 링 추가, 적용 버튼 애니메이션 추가.

## v2.9 (2026-03-03)
PNG Import Metadata Validation & UI Polish.
- **Metadata Validation:** Added `validateMetadata` function to `ImportModal.tsx` to check for missing required fields (Prompt, Negative Prompt, Seed, Sampler, Resolution, Steps, Scale) before importing.
- **UI Feedback:** Added visual indicators (red border, warning icon) to the Import Modal for any missing required fields.
- **User Experience:** Added "Required" badge to the Import Modal title and individual field labels for clarity.
- **Compatibility:** Added `source_ai_model_hash` to the Import Modal's "Settings" checkbox group, ensuring the AI model hash is always imported when Settings are enabled.
- **Documentation:** Updated `README.md` with detailed PNG Import requirements and troubleshooting.

## v2.8 (2026-03-03)
PNG Metadata Extraction Pipeline & Granular Selective Import.
- Implemented direct in-browser PNG `tEXt` chunk parsing (`pngParser.ts`), bypassing external dependencies.
- Added Drag & Drop support and a mobile-friendly "Load PNG" button in the Preset Manager for device compatibility.
- Introduced an interactive `ImportModal.tsx` overlay, enabling users to selectively apply specific metadata groups (Main Prompt, Negative Prompt, Seed, Settings) without forcibly overwriting the current state.
- Enabled granular character-level extraction: parsed the `v4_prompt.caption.char_captions` schema to build dynamic checkbox grids, allowing users to import individual character properties from multi-character images.

## v2.6 (2026-03-02)
Prompt Highlighting System.
- Created an AST-style token parser (`intensityParser.ts`) to calculate weighted NovelAI syntax (`{}`, `[]`, `weight::tag::`).
- Deployed a custom `HighlightedTextarea` component that layers a transparent `<textarea>` over colored `<span>` elements, bypassing default browser `contenteditable` limitations.
- Match highlighting colors dynamically to the active NovelAI themed intensity settings.

## v2.5 (2026-03-02)
Dynamic Theme Sync with NovelAI.
- Discovered NovelAI uses Styled-Components with no CSS custom properties. All theme colors are injected via hashed class names into `<style>` tags.
- Implemented DOM computed style scraping: `.image-gen-page` (main bg), `.image-gen-prompt-main` (panel bg), `.settings-panel` (sidebar), `textarea`/`input[type="text"]` (input bg), `label` (header text), Generate button (accent).
- Created `src/contexts/ThemeContext.tsx` with `ThemeProvider` and `useTheme` hook for context-based theme distribution.
- Extended `ThemeColors` interface: added `fontFamily`, `intensityLow`/`Mid`/`High`, `warningError`, `headerText`.
- Real-time theme sync via `MutationObserver` on `document.head` (300ms debounce). Theme changes apply without page refresh.
- Updated all components (`ApplyButton`, `PresetManager`, `CharacterCaptions`, `AutoGeneratePanel`) to use new semantic theme colors.
- Character prompt and Negative prompt textareas now vertically resizable (`resize: 'vertical'`, `minHeight` instead of fixed `height`).

## v2.4 (2026-03-01)
Live adjustments, Auto-Generate Seed Rules, and Mobile limitations documented.
- **Live Adjustable Loop:** Transitioned the Auto-Generate loop from `setInterval` to a recursive `setTimeout` referencing live React `useRef`s, allowing users to modify Interval and Target Count without stopping the loop.
- **Live Adjustment UI**: Added '조절 단위' (adjustStep) configuration and `[-]` / `[+]` buttons to Interval and Target Count inputs.
- **Seed Rule Automation:** Added dropdown for Seed Rules (None, Random, +1, -1) when the preset queue is empty. Preserves autonomy by exclusively manipulating the NAI Seed `<input>` DOM element natively instead of using Global Paste.
- **Fallback Heuristics & Mobile:** Added deep DOM traversal to find hidden Seed inputs and trigger React synthetic events. Added a fallback to click the NAI `Randomize` dice button if the input fails. Identified that mobile layout hides and unmounts inputs, necessitating a native Seed=0 workaround.

## v2.3 (2026-03-01)
Added Preset Progression, Rotation, and Randomization auto-generation features backed by `localStorage`.

## v2.2 (2026-02-28)
Mobile UI overhaul and Bookmarklet Paste pipeline improvements.

## v2.0 (2026-02-27)
Refactored monolithic App.tsx into modular hooks/components and added NovelAI V4 metadata layout support.

## v1.2
- Added stealth_pngcomp LSB encoding (defense-in-depth alongside tEXt).
- Fixed Import modal trigger: all 6 tEXt chunks required (Title, Description, Software, Source, Generation time, Comment).
- Verified end-to-end paste pipeline on desktop Chrome.

## v1.0
- Initial implementation. Single textarea for prompt, Apply button, PNG generation with tEXt chunks.
