# Work Process Instructions

## Project Scope
This is a bookmarklet-based overlay tool for NovelAI image generation. React + TypeScript + Vite, builds to a single IIFE JS file deployed via GitHub Pages. The .md notes contain the project's accumulated knowledge, decision records, and technical discoveries.

---

## Starting a Session — Understanding Context

Mandatory (read every session):
1. HANDOFF.md — task state, next steps, reference files.
2. one-pager.md — verified behaviors, gotchas, session log. The project's accumulated technical truth.

Reference (consult as needed during work):
- TODO.md: task tracking. Two independent lists: setup TODO (A~F) and automation TODO.
- GLOSSORY.md: terms and concepts learned during setup.
- decision-making/: N-th decision-making records. Documented round-by-round within task-specific subfolders.
- docs/: reference documents (architecture, automation report).
- guide/: archived knowledge from past sessions, organized by topic.

---

## During a Session

### Alignment Before Execution
Before making changes, present the files to be changed and the task details to the user. Execute according to the plan approved or adjusted by the user.

### Verification Protocol
Before making a technical claim (possible/impossible, works/doesn't work), check project records (one-pager, MEMORY.md) first — to avoid unknowingly contradicting or accepting agreed-upon facts.
If no prior record exists, verify empirically before asserting.

Trust order when sources conflict:
1. Empirical result (tested this session)
2. Project records (one-pager, previous conversation jsonl, guide/)
3. Subagent research / external inference

When delegating research to a subagent, provide relevant known facts from project records — subagents cannot access them on their own. If a subagent reports "impossible," cross-reference against project records before accepting.

---

## Wrap-up

### Response Wrap-up
- Record verified behaviors and discovered gotchas in `one-pager.md`.
- Document all unfamiliar concepts and terminology encountered while setting up Claude Code in `GLOSSORY.md`.

### Session Wrap-up
When the user sends a session termination signal ("Let's wrap up," "That's it for today," "세션 마무리," "문서 정돈," etc.), use the `/wrap-up` skill to synchronize notes.