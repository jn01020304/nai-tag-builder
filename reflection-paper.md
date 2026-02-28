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

# Reflection Paper

## Reflection Paper — 2026-02-28

### Mistake 1: Built but never committed or pushed

### What happened
I modified `defaults.ts` and ran `npm run build`, then reported the build as successful. However, this project is a bookmarklet deployed via GitHub Pages, so changes only reach users after a full git commit + push → GitHub Actions deployment cycle. I skipped that cycle entirely.

### Why it happened
`HANDOFF.md` described the deployment pipeline clearly, but I did not read it at the start of the session. I defaulted to a generic "local build = done" mental model instead of verifying this project's specific delivery path. Worse, when the user asked why things weren't working, I didn't examine my own work first — I told them to manually copy local build files, which was wrong and unhelpful.

### How to prevent it
1. Read `HANDOFF.md` before touching anything. Understand the build-to-deployment pipeline upfront.
2. Treat the full delivery chain as a checklist: code change → build → commit → push → confirm deployment.
3. When something breaks, inspect your own work first before offering the user workarounds.

### Mistake 2: Omitted the character prompt data

### What happened
I was asked to reflect the settings in `default-prompt-settings.json` into `defaults.ts`. I carried over the base prompt, negative prompt, and numeric parameters (scale, cfgRescale, useCoords, etc.), but ignored the character prompt data nested inside `v4_prompt.caption.char_captions` and left `characters: []`.

### Why it happened
I focused only on top-level key-value pairs — `prompt`, `uc`, `steps`, `scale` — and decided on my own that the nested `v4_prompt.caption.char_captions` structure wasn't relevant to defaults. I also narrowed the scope of "reflect all settings" to mean "just the simple parameters," which was not what the user intended.

### How to prevent it
1. Walk through every field in the source JSON and verify each one is accounted for.
2. When a field's inclusion is ambiguous, ask the user rather than making the call unilaterally.
3. "Reflect everything" means everything. Do not silently reduce the scope.

---

## Common principles
- HANDOFF first: Understand the project's current state and deployment path before starting work.
- Checklist-driven: Verify every field in source files and every step in the delivery pipeline.
- Suspect yourself first: When something is wrong, check your own omissions before redirecting the user.
- No scope reduction: Do not interpret "reflect all settings" as anything less than all settings.