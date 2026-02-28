# Proactive Rules

Rules that fire automatically when a trigger condition is detected — even if the user's
original prompt doesn't address them. These encode common mistakes in vibe coding workflows.

Both the Intent Executor and Prompt Improver skills apply these rules.

---

## 1. Scope Control — Prevent Implementation Overreach

**Trigger**: A task references a Phase, step, or group of tasks in a planning document.

**Problem**: The AI often implements beyond the specified step, producing unverified code
that's hard to debug when issues arise.

**Action**: Add explicit scope boundaries — what to do, what NOT to do, and a checkpoint
to report results before moving on.

```
Before: "Proceed with Phase 2 of the Roadmap."
After:  "Proceed with Phase 2.1 — [Specific Task Name].
         - Scope: Only Phase 2.1. Do not perform Phase 2.2 or other Phases.
         - Proceed one item at a time. Report results after each and wait for instruction.
         - If pending/blocking issues affect this task, notify me before starting."
```

---

## 2. Debug Requests — Specify Verification Targets

**Trigger**: An error/bug is reported and debugging or root cause analysis is requested.

**Problem**: "It's not working" without a hypothesis leads to unfocused, scattershot debugging.

**Action**: Structure the debug approach:
- **With hypothesis**: "Suspected cause is [X]. Write debug code to verify."
- **Without hypothesis**: "Diagnose step-by-step: (1) Check I/O of [Function],
  (2) Trace data flow at [Event], (3) Report results and propose next step."
- **Always**: Include the original error message if available.
- **Output format**: Numbered Markdown list citing function/variable names per item.

---

## 3. Modifications — Add Safeguards for Unscoped Changes

**Trigger**: Code modification or refactoring is directed without specifying scope.

**Problem**: Scopeless modification risks changing unrelated parts or breaking working code.

**Action**: Add a "report before execute" safeguard — list planned changes, flag if
output structure or public API changes, execute only after approval.

---

## 4. References — Enforce Document Priority

**Trigger**: A task involves checking platform rules, APIs, or constraints, and a
Project File Reference is available.

**Problem**: AI-generated reference docs often contain unverified info. Treating them
as authoritative leads to implementation based on false information.

**Action**: Apply the document priority order from the Project File Reference.
General default: verified references > planning documents > AI-generated references.
Add "cross-verify with actual code behavior" for documents with known reliability issues.

---

## 5. Documentation — Update Planning Docs on Deviation

**Trigger**: Code was modified differently from the plan due to bugs, constraints,
or new discoveries.

**Problem**: Vibe coding AIs have limited cross-session memory. If the planning doc
isn't updated, the AI may revert intentional deviations in later tasks.

**Action**: Update the specific section of the planning document, citing the exact
section and describing what changed and why.

---

## 6. Documentation — Clean Up Bloated Planning Docs

**Trigger**: Multiple phases completed, logs are excessively long, or user signals
confusion about current project status.

**Problem**: As planning docs grow, AI comprehension drops and core instructions get buried.

**Action**:
- Roadmaps: Delete completed items. Keep incomplete ones.
- Completion logs: Keep only items with lessons learned. Delete routine logs.
- Research notes: Transfer reusable findings to appropriate reference docs, then summarize.

---

## 7. Documentation — Distribute Research Findings Correctly

**Trigger**: Research results need to be recorded into project documents.

**Problem**: Without distribution criteria, the AI dumps everything into one file or duplicates.

**Action**: If a Project File Reference defines distribution rules, follow them. Otherwise:

| Type of Finding | Where It Goes |
|---|---|
| Platform-wide verified facts | Shared technical reference |
| Technical pitfalls & workarounds | Platform-specific dev guide |
| Project design decisions & debug logs | Project planning document |
| Newly discovered APIs/tools | Global project config (e.g. CLAUDE.md) |

- Don't duplicate. Record core fact in one place, reference elsewhere.
- Update existing entries in-place rather than adding new ones.
- Resolved "investigation needed" markers → replace with verified result.
