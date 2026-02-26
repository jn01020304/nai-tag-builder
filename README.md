---
language: english
formatting:
  tables: false
  bold_emphasis: minimum
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# NAI Tag Builder
Overlay tool for combining Danbooru-style tags on the NovelAI image generation page (novelai.net/image). Built for mobile browsers where typing tags one by one is too slow.

## How It Works
1. Tap the bookmarklet — tag builder UI appears on top of NovelAI page.
2. Combine tags and tap "Apply" — a dummy PNG with metadata is generated in memory.
3. Programmatic paste delivers the PNG to NovelAI — Import fills in all prompt fields at once.

No separate app, no tab switching, no file download/upload.

## Features (by priority)
1. Preset system — save and load frequently used tag combinations.
2. Autocomplete — based on Danbooru tag database.
3. Character presets — auto-fill appearance/outfit tags for specific anime characters.
4. Custom character builder — pick from categories (hair color, eye color, outfit, etc.).

## Target Environment
- Chrome mobile (primary)
- Kiwi browser (development/debugging)
- Desktop Chrome (compatible)

## Tech Stack
React, TypeScript, Vite. Builds to a single IIFE JS file (`nai-tag-builder.js`).