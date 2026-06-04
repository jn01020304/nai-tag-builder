# Next Session Handoff

Date: 2026-06-04

Project path: `D:\my-projects\nai-tag-builder`

Current product direction: `nai-tag-builder` is a lightweight mobile Chrome bookmarklet overlay for NovelAI. It should behave as a Mobile Overlay Cockpit, not as a desktop image-generation studio, Electron app, or Danbooru tag database product. The core value is fast mobile prompt assembly, safe NovelAI-compatible metadata application, and later queue/review/handoff workflows.

## Current State

The project is in the transition from v2 Automation reliability into v3 Queue implementation.

Completed foundations:

- The macro architecture has been documented around a rigid overlay shell: Header for status, Body for one active work surface, Footer for fixed execution controls.
- Runtime and offline boundaries are defined. Danbooru tag processing belongs to offline catalog building; runtime loads only the bundled Core Catalog.
- Compose MVP works with category chips, direct Raw Prompt editing, cursor-aware insertion, token-boundary correction for fat-finger cursor placement, drag reorder, and global assignment badges.
- Tags can be routed into Base Prompt, Negative Prompt, Character Prompt, and Negative Character Prompt.
- Chip visual state is global, not only focus-local. Assignment badges remain visible across prompt targets using `m`, `n`, `c1`, `nc1`, `c2`, `nc2`, and so on.
- v2 Automation uses a Promise-based staged apply pipeline with explicit status, Status Banner feedback, and duplicate execution locking.
- SDStudio original and fork were reviewed as a technical spike. The result is documented in `docs/SDSTUDIO_TECHNICAL_SPIKE.md`.
- v3 Queue architecture is documented in `docs/V3_QUEUE_ARCHITECTURE.md`.

Latest implementation work:

- Added queue domain foundation in `src/queue/queueTypes.ts`, `src/queue/queuePlanner.ts`, and `src/queue/queueSession.ts`.
- Refactored `src/hooks/useAutoGenerator.ts` to use QueueDraft, QueueTickPlan, QueueSession, preflight warnings, and stop-on-failure semantics.
- Replaced `src/components/AutoGeneratePanel.tsx` with `src/components/QueuePanel.tsx`.
- Simplified `src/components/PresetManager.tsx` so it no longer owns Queue mode controls.
- Connected QueuePanel through `src/App.tsx`.
- Added QueuePanel coverage to `scripts/e2e/compose-smoke.mjs`.
- Rebuilt `dist/nai-tag-builder.js`, which is tracked and must remain updated for bookmarklet use.

Current git state is intentionally dirty. Do not reset or discard changes unless explicitly asked. Important changed paths are:

- `.gitignore`
- `dist/nai-tag-builder.js`
- `scripts/e2e/compose-smoke.mjs`
- `src/App.tsx`
- `src/components/PresetManager.tsx`
- `src/hooks/useAutoGenerator.ts`
- deleted `src/components/AutoGeneratePanel.tsx`
- new `src/components/QueuePanel.tsx`
- new `src/queue/`
- new `docs/SDSTUDIO_TECHNICAL_SPIKE.md`
- this handoff document

## Validation Already Passed

The following checks passed after the latest QueuePanel work:

- `rtk npm run build`
- `rtk npm run lint`
- `rtk npm run test:e2e:compose`
- `rtk npm run test:e2e:bookmarklet`
- `rtk git diff --check`

The compose smoke runs a mobile viewport browser flow and currently covers:

- Raw Prompt typing
- cursor-position tag insertion
- repeated insertion at the corrected cursor position
- chip removal
- fat-finger token-boundary insertion
- Character Prompt insertion
- Negative Prompt insertion
- Negative Character Prompt insertion
- dynamic character badge numbering
- global badge persistence after focus changes
- selected tag drag reorder
- layout overlap checks
- prompt label contrast check
- QueuePanel visibility and basic controls
- Apply lock and automation timeout feedback

`test-results/compose-smoke-mobile.png` is produced by the compose smoke and can be inspected when visual QA is needed.

## Local Run Notes

Use RTK-prefixed commands.

For normal checks, use:

- `rtk npm run build`
- `rtk npm run lint`
- `rtk npm run test:e2e:compose`
- `rtk npm run test:e2e:bookmarklet`

For a local dev server, prefer direct Vite invocation if npm argument forwarding behaves oddly:

- `rtk node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`

Previous pitfall: `rtk npm run dev -- --host 127.0.0.1 --port 5173` was parsed in a confusing way in one session, so the in-app Browser initially failed with connection refused. The Playwright smoke script itself starts Vite correctly through Node and did pass.

Before ending a work turn, check that no Vite process remains:

- `rtk pwsh -NoProfile -Command 'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "vite" -and $_.CommandLine -match "nai-tag-builder" -and $_.Name -match "node" } | Select-Object ProcessId, CommandLine'`

## Architecture Guardrails

Keep these boundaries intact:

- Prompt UI should not know NovelAI DOM selectors.
- Automation should not know visual chip/category behavior.
- Queue planning should not directly mutate MetadataState.
- Offline catalog generation should not leak into runtime UI logic.
- Bookmarklet runtime should not store or process NovelAI API keys.
- SDStudio should remain a reference model, not a porting target.

Do not introduce these yet:

- Electron, Capacitor, native modules, or server-required runtime.
- Direct NovelAI API calls from the bookmarklet.
- A heavy settings menu for color customization.
- LLM-based phrase rewriting.
- Vision AI review.
- Metadata vault or steganography workflows.
- A massive runtime Danbooru tag DB.

## Next Recommended Work

The next step should continue v3 Queue, but keep it narrow.

Recommended next slice:

1. Add focused unit tests for `queuePlanner.ts` and `queueSession.ts`.
2. Extract runtime execution from `useAutoGenerator.ts` into a clearer queue runner boundary, likely `src/queue/queueRunner.ts` or `src/queue/useQueueRunner.ts`.
3. Keep `useAutoGenerator.ts` as the React bridge only: read UI settings, create QueueDraft, start/stop the runner, expose QueueSession.
4. Add a small bounded Queue event log model, but do not build a large log UI yet.
5. Add Queue preflight copy to Status Banner when count, interval, seed, or preset queue settings are invalid.
6. Re-run build, lint, compose smoke, bookmarklet smoke, and diff check.

The next implementation should prove this flow:

- user enables Queue
- Apply succeeds
- QueueSession starts
- one tick creates a QueueTickPlan
- metadata is applied through the existing v2 Automation pipeline
- failure stops the queue with a visible Status Banner hint
- Stop prevents further ticks

## UX Position To Preserve

Queue should feel like a short mobile task launcher, not a desktop scheduler.

Good Queue language:

- this preset for 8 images
- increment seed
- apply character presets in order
- stop on failure
- show last error

Avoid:

- dense cron-like controls
- long queue tables
- hidden background automation
- retry loops without user-visible state
- continuing generation after failed NovelAI import

## Bookmarklet Deployment Reminder

The user tests on NovelAI through:

- `javascript:void(document.body.appendChild(Object.assign(document.createElement("script"),{src:"https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js"})))`

If the user cannot see changes on NovelAI:

- confirm `dist/nai-tag-builder.js` was rebuilt
- confirm GitHub Pages or deployment picked up the new bundle
- add a temporary cache-busting query string to the bookmarklet source if needed
- remind that changing local source alone does not affect the hosted bookmarklet

Do not silently assume the NovelAI page is running the local build.

## Senior Judgment For The Next Session

The project is currently healthy because the work is being sliced vertically. Keep that discipline. Do not jump from Queue into Review/Handoff, LLM rewriting, metadata vault, or SDStudio-style task graphs until Queue has a boring, reliable stop-on-failure loop.

The main engineering risk now is not UI styling. It is ownership drift: if `useAutoGenerator.ts` keeps accumulating queue planning, session state, timer control, automation calls, and UI feedback mapping, it will become the next monolith. The next session should reduce that risk by moving queue runtime logic behind a queue-specific boundary while preserving the existing mobile UX.
