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

# Handoff

Status: v2.0 deployed to GitHub Pages. Full metadata UI working. End-to-end verified on desktop Chrome.

## What Was Done This Session
- Refactored monolithic App.tsx into modular architecture:
  - `types/metadata.ts` — full NovelAI V4 Comment JSON types.
  - `model/defaults.ts` + `model/buildCommentJson.ts` — UI state to JSON transform.
  - `encoding/pngEncoder.ts` + `encoding/pasteDispatch.ts` — tEXt chunks + LSB + paste event.
  - `hooks/useMetadataState.ts` — useReducer central state (~25 fields).
  - `components/` — PromptSection, GenerationParams, CharacterCaptions, NegativePrompt, AdvancedParams, CollapsibleSection, ApplyButton.
  - `styles/theme.ts` — Catppuccin Mocha color tokens.
- UI now covers all NovelAI generation fields: multi-character presets (char_captions with x/y center), negative prompt (base + per-character), sampler, noise schedule, seed, dimensions, advanced params.
- Fixed React scheduler conflict with NovelAI's Next.js page — `flushSync()` in main.tsx.
- Set up GitHub repo (public), GitHub Actions CI/CD, GitHub Pages deployment.
- Bookmarklet URL: `javascript:void(document.body.appendChild(Object.assign(document.createElement('script'),{src:'https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js'})))`
- End-to-end verified: bookmarklet → overlay → Apply → Import modal → image generated.

## Current State
- Source: 16 TypeScript files under `src/`.
- Build: `npm run build` → `dist/nai-tag-builder.js` (211KB, gzip 66KB).
- Deploy: push to main → GitHub Actions builds → GitHub Pages serves.
- Git repo: `https://github.com/jn01020304/nai-tag-builder`
- Diagnostic scripts in `scripts/` still present (can be archived).
- `test.html` in root for local UI testing (open in browser directly).

## Next
1. Test on actual mobile Kiwi browser to confirm end-to-end.
2. Feature work: preset save/load (localStorage), Danbooru tag autocomplete, character preset library.
3. UX polish: drag to reposition overlay, mobile touch optimization.
4. Clean up: remove diagnostic scripts, unused CSS files (App.css, index.css global styles that may leak into NovelAI page).
