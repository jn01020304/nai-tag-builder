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
Preset Progression, Rotation, and Randomization.
- Preset data model: `Preset` interface (`id`, `name`, `state: MetadataState`, `createdAt`) in `src/types/preset.ts`.
- localStorage CRUD layer: `src/model/presetStorage.ts` (save by name, load all, delete by id, get by id, reorder).
- `LOAD_PRESET` action in `useMetadataState.ts` — replaces entire editor state with a saved preset's snapshot.
- `PresetManager.tsx`: save current state as named preset, list presets with Load/Queue/Delete, queue chip display with ▲/▼ reorder, Progression/Random mode selector.
- Auto-generate loop extended: when queue is non-empty, each tick loads the next preset (sequential or random) from localStorage and dispatches its metadata instead of the fixed editor state.
- Preset Import/Export: 📥 Import (JSON file → merge into localStorage) and 📤 Export (all presets → JSON file download) buttons in PresetManager UI.

## v2.2 (2026-02-28)
Mobile verification + UX overhaul.
- Mobile end-to-end verified on Samsung Galaxy (Chrome). Bookmarklet → overlay → Apply → Import → Generate → image created.
- Auto-import: paste dispatch now auto-clicks "Import Metadata" and scrolls to Generate button. No manual modal interaction needed.
- Optional auto-generate: "적용 후 자동 생성" checkbox auto-clicks Generate button after import. Repeat mode generates every N seconds (configurable, default 30s, clamp 3~1800s).
- Overlay collapse (▼/▲): minimize to header-only strip. Apply button collapses instead of closing.
- Drag to reposition: header acts as drag handle (mouse + touch). `touchAction: 'none'` for mobile.
- Overlay reopen: close (✕) removes container from DOM so bookmarklet can recreate it without page refresh.
- Fixed: overlay at `bottom: 20px` covered Generate button on mobile → moved to `top: 20px`.
- Fixed: index.css global styles (`body`, `button`, `a`) leaked into NovelAI page → removed import.
- Fixed: `isApplying` stuck true after successful Apply → moved reset to `finally` block.

## v2.0 (2026-02-27)
- Refactored monolithic App.tsx into modular architecture (types, model, encoding, hooks, components, styles).
- Full NovelAI V4 metadata support: multi-character presets (char_captions), negative prompt, all generation parameters.
- UI: collapsible sections for Parameters (default open), Characters, Negative Prompt, Advanced. Dimension presets (Portrait/Landscape/Square). Sampler and noise schedule dropdowns.
- Fixed React rendering on NovelAI page: flushSync() to bypass scheduler conflict with host page React.
- GitHub Pages deployment via GitHub Actions. Bookmarklet now loads from public HTTPS URL.

## v1.2
- Added stealth_pngcomp LSB encoding (defense-in-depth alongside tEXt).
- Fixed Import modal trigger: all 6 tEXt chunks required (Title, Description, Software, Source, Generation time, Comment).
- Verified end-to-end paste pipeline on desktop Chrome.

## v1.0
- Initial implementation. Single textarea for prompt, Apply button, PNG generation with tEXt chunks.
