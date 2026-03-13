---
language: english
---

# Archived Findings — Codebase Overhaul (2026-03-13)

Source: Findings (one-pager.md)
Reason: Codebase overhaul 9 items completed. Feature-specific findings no longer needed every session.
Date: 2026-03-13

---

### D2 Nested Migration: Missed Files Discovery
D2 flat→nested restructuring touched 8 files (~90 accesses). Two files (PresetManager.tsx, useAutoGenerator.ts) were missed because they access MetadataState indirectly — PresetManager reads from translateNovelAiMetadata return value, useAutoGenerator reads from stateRef. Neither was in the initial impact analysis (2.md). Discovered only when tsc was run post-D2. Lesson: always run full tsc after structural refactoring, even when impact analysis seems complete.

### isVeryDark BT.601 Luminance Formula
BT.601 weighted luminance `(0.299*R + 0.587*G + 0.114*B) / 255` replaces hardcoded 5-RGB-string whitelist. Threshold 0.5 (dark below, light above). Fallback on regex parse failure: `true` (assume dark). Handles all `rgb()` and `rgba()` format strings from `getComputedStyle`.

### useEdgeResize Hook Extraction Pattern
Resize logic extracted from App.tsx to `useEdgeResize(minWidth)`. Returns `{ overlayWidth, startResize }`. The `startResize` closure captures `overlayWidth` at call time into `startWidth` — this is intentional (drag starts from current width). React useState value is stale in the closure but only the initial capture matters for delta calculation.

### MetadataState Restructuring Impact
Flat→nested restructuring affects ~90 field access patterns across 8 files. Critical: buildCommentJson (23 accesses), metadataTranslator (22), GenerationParams (16), AdvancedParams (13), ImportModal (17), useMetadataState (12+). SET_FIELD dispatch pattern needs redesign. D2 must not be combined with R3 (data loss fix) — different urgency, atomic verification impossible if combined.

### D1+R3+R4 Roundtrip Verification (Live)
After D1 (use_coords/use_order parsing), R3 (14 field coverage), R4 (normalizeMetadataState), deployed build passes live NAI site test. PNG drag-and-drop → ImportModal → NAI paste pipeline: NAI internal JS (`1883-*.js`) accepts the rebuilt Comment JSON with signed_hash="" and hardcoded extra_passthrough_testing without rejection. All 44 Comment JSON keys are parsed. NAI UI correctly reflects imported values (Steps, Guidance, Seed, Sampler, Noise, Resolution, CFG Rescale). Roundtrip test: 0 DIFF (signed_hash excluded as server-generated). ImportModal.handleApply was missing 13 fields in the importSettings branch (11 R3 + 2 D1: useCoords/useOrder). Fixed before deployment.

### N차 의사결정: Code Work Adaptation
Starting from a technical audit (listing code problems) is not 탐색. 탐색 starts from user intent and pain points, identifies components collaboratively. Simple investigations (grep, code search) must not be deferred to 심화 — do them immediately. Decision rounds must produce tentative decisions, not open questions for the user. The decision-making process needs 4 adaptations for code work: (1) dependency mapping in 탐색, (2) [internal]/[external] breaking change tags, (3) verification criteria in 심화, (4) test co-creation in 구현. Preserved in decision-making/codebase-overhaul/feedback_decision_making.md.
