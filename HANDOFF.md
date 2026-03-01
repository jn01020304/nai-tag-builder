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

# Handoff — 2026-03-01
Status: v2.4 built locally. Refactoring complete. Awaiting manual browser test by user.

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

---

## What Was Done This Session

### Seed Injection Final Fix
- Fixed `random` seed rule: was only clicking the button without injecting metadata, causing "Identical parameters" block.
- `random` now generates `Math.floor(Math.random() * 4294967295)` per loop, embeds it in PNG metadata, and pastes.
- `none` is the only rule that clicks the button without metadata injection.
- Button re-enable wait increased from 300ms to 500ms. Button is re-queried before click to avoid stale DOM references.

### Seed Rule Definitions
- `none`: clicks Generate only, no metadata injection. User sets NAI UI manually.
- `random`: injects a random seed via metadata paste each loop. Prevents duplicate-parameter blocks.
- `increment` / `decrement`: adjusts seed by ±1 via metadata paste. For sequential seed exploration.

### Code Refactoring (App.tsx God Component Split)
- `App.tsx`: 505 lines → 274 lines.
- `src/hooks/useAutoGenerator.ts` [NEW]: auto-generate loop, seed rules, preset queue cycling logic.
- `src/components/AutoGeneratePanel.tsx` [NEW]: auto-generate UI (checkbox, seed rule dropdown, interval/count inputs).
- `src/types/preset.ts`: added and exported `SeedRule` type.

### ARCHITECTURE.md Update
- Rewritten with As-Is (current) and To-Be (target) structure.
- Removed obsolete DOM manipulation code references. Accurately documents current seed rules and encoding pipeline.
- Specifies future extension points (DB adapter swap, preset progression hook expansion).

---

## Current State
- Build: success (`dist/nai-tag-builder.js` 228KB)
- Unused variable cleanup in App.tsx: done
- Browser manual test: pending (user must verify)
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Bookmarklet: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?v='+Date.now()})))`

---

## ## What Remains

### Immediate — Manual Testing
- User tests new build on NovelAI:
  - `random` rule: confirm repeated generation without "Identical parameters" error.
  - `increment` rule: confirm seed increments by +1 each loop.
  - Preset queue + auto-generate: confirm existing behavior unchanged.

### Known Technical Debt
- `executeLoop` inside `useAutoGenerator.startLoop` captures `state`/`queue`/`seedRule` via closure. Currently works, but must switch to `useRef` pattern when implementing preset progression.

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

Priority 3 — Management:
- Tinder-style swipe image selection UI
- Image error detection (vision AI heatmap)
- Tap-to-mask inpainting assist
- Side-by-side image comparison UI
- Prompt history archive (search and reuse)

Priority 3 — Authoring Convenience:
- Tag chip drag-and-drop reordering
- Negative prompt template toggle
- AI prompt recombination suggestions
- Smart tab auto-categorization ([character], [background], [composition])
- Bottom sheet weight adjustment popup
- Comic/storyboard generation mode

Priority 3 — Automation:
- AI usage pattern prompt recommendation report
- DB import/export
- Cross-device sync (Firebase/Supabase + Google login)

Later:
- AI assistant personality/tone settings
- User taste statistics UI
- Onboarding screen
- App name decision (candidates: PromptAIO, TagMaster AIO, OmniPrompt, DanbooruAIO, AIO Canvas)
- iOS/Android gesture conflict testing
- API key client-side security decision

---

## Previous Session History

### Seed Injection Debugging (Resolved)
- Implemented `revealSeedInputAndSet()` UI crawler. Failed due to React 19 controlled input behavior making DOM manipulation impossible.
- Added `[SEED-DEBUG]` logging, analyzed output, switched to metadata PNG paste approach. Issue resolved.
- Debug logging removed.