---
name: 정돈
description: Synchronize session notes at session end. Use when the user signals session termination — "Let's wrap up", "Organize the work done so far into notes," "Let's commit," "세션 마무리", "우리가 나눈 대화 기록을 문서로 정리해," or any instruction to finalize the session's work.
---

# Session Wrap-up
Reflect the changes implemented during the session in the notes so that the next session can be handed over in the same context. Perform the following synchronization and report the results.

---

## Routing Rules — Where Does Each Finding Go?
Before recording, determine which document it belongs to. A single discovery can appear in two documents if it has both aspects — but each document records only its own concern.

### one-pager.md vs ARCHITECTURE.md
- **ARCHITECTURE.md** records what we built and why — module structure, platform mechanisms that drove design choices.
- **one-pager.md** records what we discovered while coding — how platform APIs actually behave, what patterns are safe, what breaks.
- If a finding explains the design → ARCHITECTURE.md. If it warns you while writing code → one-pager.md.
- Example: "CSS scoping silently strips external stylesheets" → one-pager.md (coding warning). "We adopted inline styles because of CSS scoping behavior" → ARCHITECTURE.md (design rationale).

### HANDOFF.md vs one-pager.md session log
- **HANDOFF.md** tracks task state — what was completed, what is blocked, what to do next. Answers "where did we leave off?"
- **one-pager.md session log** tracks technical findings — API behaviors, error patterns, workarounds. Answers "what did we learn?"
- A bug's existence and status → HANDOFF.md. The technical insight from investigating that bug → one-pager.md.
- Example: "Image display broken — unresolved" → HANDOFF.md. "getChatVar returns 'null' string instead of nil" → one-pager.md.

---

## Synchronization Procedure
Update in this order (high frequency / narrow scope first). Before recording, check if the content already exists.

### A. one-pager.md
- **During a session**: Record bugs and API discoveries in the Session Log.
- **Session transition** (version release or user declares new session): Reset Session Log. Preserve Evergreen Notes and Bug Investigation.
- **Promotion**: When a session log finding is verified across multiple sessions, promote to Evergreen Notes. If the finding is about module structure or design rationale, it belongs in ARCHITECTURE.md instead.

### B. HANDOFF.md
- Overwrite entirely with: what was done this session, what remains, pending verification steps.
- Each session overwrites the previous contents.

### C. Changelog.md
- Update only on version release.
- Keep detailed content for the last 4 versions. Compress older versions to one-line summaries.

### D. ARCHITECTURE.md
- Update when module structure changes: new components, changed data flow, new design decisions, or newly understood platform mechanisms.
- Scope: how components connect, why choices were made, platform context that shaped them.

---

## guide/ Archive Rules
- When one-pager.md Evergreen Notes and Bug Investigation grow too large, move confirmed entries to guide/.
- Files are organized by topic (e.g., guide-lua.md, guide-cbs.md). Append to existing files.
- If a finding is specific to a particular project, add a cross-reference link to the relevant context.

---

## Additional Notes
$ARGUMENTS