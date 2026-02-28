---
name: intent-executor
description: Infer user intent from incomplete or vague prompts in a vibe coding session, then execute after confirmation. Use when the user gives a brief or ambiguous instruction that needs clarification before safe execution, such as "작업을 진행하세요", "다음 단계로 넘어가세요", "제안해준 대로 따르겠습니다", or any task instruction that lacks scope, targets, or success criteria. Do NOT use when the user's instruction is already clear and complete.
---

# Intent Executor

You operate inside the user's active vibe coding session. When the user gives an incomplete or vague instruction, your job is to infer what they actually want, confirm it, and then execute — not to produce an improved prompt.

## Why This Exists as a Skill (Not in CLAUDE.md)

If this logic were in CLAUDE.md, every instruction — including already clear ones — would go through the inference-confirmation loop, adding unnecessary overhead. As a skill, it activates only when needed.

---

## How It Works

### Step 1: Infer Intent
Gather context from these sources:

1. Session history: the current conversation already available to you.
2. Project files: read relevant files as needed (planning docs, code, references).
3. Project File Reference: if a `prompt-ref.md` (or equivalent) exists in the project folder, read it to understand file roles, reliability levels, and rules.

From these, construct a concrete execution plan that includes:
- What: specific functions, files, logic areas
- Scope: what will NOT be touched
- Approach: how you intend to implement it
- Risks: anything that might break or require attention

### Step 2: Confirm
Present the inferred plan to the user concisely. For example:

```
이렇게 이해했습니다:
- generateMapHtml의 CSS 클래스 정리 (출력 HTML 구조는 유지)
- 대상: 라인 120–185의 스타일 관련 로직만
- 다른 함수는 수정하지 않음

이대로 진행할까요?
```

Do not execute anything before confirmation.

### Step 3: Execute or Re-infer
- Approved → Execute the plan. Apply Proactive Rules during execution
  (see `../shared/proactive-rules.md`).
- Rejected → Ask targeted questions about the parts you got wrong.
  Do not restart from zero; refine the specific misunderstanding.
- Partially approved → Execute the approved parts, hold the rest for clarification.

---

## Applying Proactive Rules

Read `../shared/proactive-rules.md` and apply relevant rules to your *execution plan*
(not to a prompt, since there is no separate prompt to improve). For example:

- If the task references a Phase → apply Rule 1 (scope boundaries) to your plan.
- If the task involves debugging → apply Rule 2 (structured diagnostics) to your approach.
- If modifications are involved → apply Rule 3 (report before execute) — which
  is already built into this skill's Step 2.

---

## Project File Reference

If the project has a file reference document (e.g., `prompt-ref.md`), read it during Step 1 to understand:
- Which files are reliable vs. need cross-verification
- Document priority order for platform rule lookups
- How research findings should be distributed

See `../shared/project-file-reference-template.md` for the template.

---

## When NOT to Use This Skill

If the user's instruction already specifies scope, targets, and approach clearly,
skip the inference-confirmation loop and just execute. This skill is for bridging the gap between vague intent and safe execution — not for adding friction to already-clear instructions.