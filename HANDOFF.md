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
Status: v2.5 built and deployed to GitHub Pages. Theme sync verified by user. Awaiting further polish.

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
- Intensity color scraping depends on prompt content. Empty prompt → no intensity spans → fallback defaults.
- Font scraping incomplete: `body.fontFamily` returns one font, but NAI Theme Editor has separate Header Font and Paragraph Font.
- `document.head` MutationObserver fires on all style changes, not just theme. 300ms debounce mitigates but may cause performance issues under heavy page activity.

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