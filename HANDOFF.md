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

# Handoff — 2026-03-02
Status: v2.6 built and deployed to GitHub Pages. Added Tag Weight highlighting to match NovelAI.

## Evergreen Notes

### React 19 Controlled Input
- React 19 controlled inputs revert values set via `nativeInputValueSetter` immediately.
- `dispatchEvent(new Event('input', { bubbles: true }))` is also overwritten by React's fiber reconciler.
- Conclusion: NovelAI's seed input cannot be set via DOM manipulation. Only the metadata PNG paste pipeline is reliable.

### NovelAI Metadata Paste Pipeline
- Dispatching `ClipboardEvent('paste')` on the `.ProseMirror` element causes NovelAI to intercept and show an "Import Metadata" button.
- Automation sequence: click "Import Metadata" → wait for modal close → click Generate.
- `autoImportAndScroll()` uses `waitFor()` polling to wait for the button (up to 3 seconds).

### Generate Button Disable Timing
- Generate button stays `disabled` while a previous image is generating.
- After clicking the Randomize (dice) button, Generate re-enables after 300–500ms due to React state update.
- Stale DOM reference risk: always re-query the button via `querySelectorAll` right before clicking. Storing button references can lead to detached DOM nodes.

### flushSync Required
- NovelAI uses React 19. The async MessageChannel scheduler in our bundled React conflicts with it, causing `createRoot().render()` to produce empty DOM.
- Wrapping in `flushSync()` forces synchronous rendering.

### No Global CSS
- Importing `index.css` into the NovelAI page destroys NAI's own button/body styles.
- All styles must go through inline React style objects or `theme.ts`.

### NovelAI Styled-Components Theming
- NovelAI does NOT use CSS custom properties. All colors injected via Styled-Components with hashed class names.
- `document.body.backgroundColor` always stays `rgb(19, 21, 44)` regardless of theme. Real themed background is on `.image-gen-page`.
- Theme changes replace `<style>` tags in `<head>`. No class/attribute changes on `<html>`/`<body>`.
- Observe `document.head` with `MutationObserver({ childList: true, subtree: true })` for real-time detection.

---

## What Was Done This Session

### Dynamic Theme Sync (v2.5)
- Discovered NovelAI uses Styled-Components with no CSS variables. Previous CSS variable approach was fundamentally wrong.
- Implemented DOM computed style scraping from `.image-gen-page`, `.image-gen-prompt-main`, `.settings-panel`, `textarea`, `input[type="text"]`, `label`, and Generate button.
- Added `ThemeColors` fields: `fontFamily`, `intensityLow`, `intensityMid`, `intensityHigh`, `warningError`, `headerText`.
- Created `ThemeProvider` context (`src/contexts/ThemeContext.tsx`) wrapping the app to distribute dynamic theme.
- Added `MutationObserver` on `document.head` with 300ms debounce for real-time theme sync when user switches themes in NAI settings.
- Updated all components (`ApplyButton`, `PresetManager`, `CharacterCaptions`, `AutoGeneratePanel`) to use the new theme colors (`warningError` for delete buttons, `green`/`intensityMid` for action buttons).

### Textarea Resize
- Character prompt and Negative prompt textareas changed from `resize: 'none'` to `resize: 'vertical'` with `minHeight` instead of fixed `height`.

### Browser Subagent Investigations
- Two browser subagent sessions deployed to NovelAI to map DOM structure.
- Identified reliable selectors: `.image-gen-page`, `.image-gen-prompt-main`, `.settings-panel`.
- Confirmed intensity color classes: `low-intensity-color-*`, `mid-intensity-color-*`, `high-intensity-color-*` on `<span>` elements.

### Tag Weight Highlighting (v2.6)
- Created `intensityParser.ts` to tokenize NovelAI prompt syntax (`{}`, `[]`, `weight::tag::`) into `high`, `mid`, `low` intensity levels.
- Created `HighlightedTextarea.tsx`, a custom component that layers a transparent textarea over a `div` holding colored `<span>` elements. 
- Integrated this new component into `PromptSection`, `NegativePrompt`, and `CharacterCaptions` replacing standard textareas. Tags now highlight with NovelAI Theme colors in real time.

---

## Current State
- Build: success (`dist/nai-tag-builder.js`)
- Deploy: pushed to `main`, GitHub Pages live
- Theme sync: working — user confirmed basic theme switching works
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Bookmarklet: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?v='+Date.now()})))`

---

## What Remains

### Known Weaknesses (Technical Debt)
- `isVeryDark` heuristic: compares `mainBg` against hardcoded RGB strings. Should switch to luminance calculation.
- Intensity color extraction uses probe element technique: creates hidden `<span class="{type}-intensity-color-40">`, reads `getComputedStyle().backgroundColor`, removes span. NovelAI defines literal CSS classes `.{low|mid|high}-intensity-color-{0..40}` (NOT hashed Styled-Components). Level 40 = 100% alpha = pure base RGB.
- Font scraping incomplete: `body.fontFamily` returns one font, but NAI Theme Editor has separate Header Font and Paragraph Font.
- `document.head` MutationObserver fires on all style changes, not just theme. 300ms debounce mitigates but may cause performance issues under heavy page activity.

### Pre-Refactoring Required
Before proceeding to Priority 1–2 roadmap features, the following structural issues should be addressed.

#### R1. isVeryDark → Luminance Calculation
- Current: `isVeryDark` compares `mainBg` against 5 hardcoded RGB strings.
- Problem: any new theme with an unlisted dark color defaults to light-mode styling. Breaks silently.
- Fix: parse RGB, calculate luminance: `(0.299*R + 0.587*G + 0.114*B) / 255 < 0.5`.
- Blocks: nothing directly, but is a ticking reliability issue.

#### R2. Theme Globals → Context Hook Migration
- Current: 10 components import `theme`, `inputStyle`, `labelStyle`, `smallBtnStyle` as mutable module-level globals from `theme.ts`. These globals are reassigned at runtime by `useDynamicTheme()`.
- Problem: works by coincidence — React re-render happens to pick up mutated globals. But globals are evaluated once at module load time for static constants like `miniBtn` and `chipStyle` in `AutoGeneratePanel.tsx` and `PresetManager.tsx` (lines 29–32, 94–113). These never update after theme change.
- Fix: all components should consume theme via `useTheme()` from `ThemeContext`. Remove the global `export let theme` pattern. Move style builders into the component render path or into a `useStyles(theme)` hook.
- Blocks: design system setup (Priority 1). Any new component would inherit the broken pattern.

#### R3. App.tsx Drag/Resize Logic Extraction
- Current: `startDrag()` (lines 19–50) and `startResize()` (lines 98–125) are defined inside `AppContent`, attaching raw `mousemove`/`touchmove` listeners to `window`.
- Problem: mixes window interaction logic with business rendering. Makes App.tsx harder to extend.
- Fix: extract into `useWindowDrag(ref)` and `useEdgeResize(ref)` custom hooks.
- Blocks: adding new draggable/resizable panels (e.g. tag weight editor).

#### R4. presetStorage Leaky Abstraction
- Current: `presetStorage.ts` functions (`loadPresets`, `savePreset`, etc.) directly serialize and deserialize `MetadataState` as JSON strings. `PresetEntry.settings` is `string` (JSON blob).
- Problem: if `MetadataState` schema changes (R3), all stored presets become incompatible. No migration strategy.
- Fix: add a `version` field to `PresetEntry`. Write a migration layer that upgrades old schema presets on load.
- Blocks: MetadataState restructuring (R3), DB schema design (Priority 1).

#### R5. MetadataState Flat Structure
- Current: `MetadataState` is a flat object with 22 fields, mixing prompt content (`basePrompt`, `characters`) with generation params (`steps`, `scale`, `sampler`) and advanced flags (`smea`, `preferBrownian`).
- Problem: prompt compiler (Priority 2) needs to operate on prompt data separately from generation params. Current flat structure forces the compiler to cherry-pick fields.
- Fix: restructure into nested sub-types: `{ prompt: PromptState, params: GenerationParams, advanced: AdvancedFlags }`.
- Blocks: prompt compiler, tag weight editing UI (Priority 2).

### Roadmap from ARCHITECTURE.md
Priority 1 — Foundation:
- DB schema design (`{ id, keyword, category, weight, isEnabled, isNegative }`)
- Design system setup
- NovelAI API integration test

Priority 2 — Core Pipeline:
- Natural language → Danbooru tag conversion AI
- Tag weight editing UI (bar graph + slider)
- Prompt compiler (tag object array → NovelAI syntax string)
- Image generation call and result display

Priority 3 — Management, Authoring, Automation:
- See ARCHITECTURE.md for full list.

---

## Previous Session History

### Seed Injection Debugging (Resolved)
- Implemented `revealSeedInputAndSet()` UI crawler. Failed due to React 19 controlled input behavior.
- Switched to metadata PNG paste approach. All seed rules (random, increment, decrement) now use paste pipeline.

### Code Refactoring (v2.4)
- `App.tsx`: 505 lines → 274 lines.
- `src/hooks/useAutoGenerator.ts` [NEW]: auto-generate loop, seed rules, preset queue cycling.
- `src/components/AutoGeneratePanel.tsx` [NEW]: auto-generate UI.