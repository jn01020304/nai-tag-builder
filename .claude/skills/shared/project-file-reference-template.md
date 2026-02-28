# Project File Reference Template

## Purpose
This template helps you create a project-specific reference that the Prompt Improver skill
can use to make context-aware improvements. Fill it in once per project, and the skill will
automatically apply your project's rules when improving prompts.

## How to Use
1. Copy this template to your project directory (e.g., `project/prompt-ref.md`).
2. Fill in each section based on your project's actual file structure.
3. When asking for prompt improvements, mention that you have a project file reference,
   or include it in the context.

---

## Task Workflow

Define how your project files connect. This helps the skill determine which stage a prompt
belongs to and proactively supplement missing instructions.

```
[PLAN] Determine design/direction in ___
↓
[REFERENCE] Check platform rules in ___
↓
[IMPLEMENTATION] Write code in ___
↓ (If new features or changes are required)
[VERIFICATION] Test in ___
↓ (After verification is complete)
[INTEGRATION] Reflect changes in ___
↓ (If problems occur)
[ROLLBACK] Compare with ___ and perform partial rollback

[SUPPORT] ___ — (describe role)
```

---

## Project-Specific Proactive Rules

Add rules specific to your project. Each rule needs:
- **Trigger Condition**: When does this rule activate?
- **Problem**: What goes wrong without this rule?
- **Action**: What should be added to the prompt?

### Example Rule: Document Priority Order
```
Trigger: Prompt directs checking platform rules or APIs.
Problem: [AI-generated doc] contains unverified info (⚠ markers).
Action: Specify reference priority:
  1. [Verified reference doc] — tested and confirmed.
  2. [Planning doc research notes] — verified during debugging.
  3. [AI-generated doc] — use only if above two lack info; cross-verify with code.
```

### Example Rule: Research Distribution
```
Trigger: Prompt directs recording research findings.
Action: Distribute as follows:
  - Platform-wide verified facts → [shared reference doc]
  - Technical pitfalls & workarounds → [platform dev guide]
  - Project design decisions → [planning doc] Section ___
  - New API/tool discoveries → [project config, e.g. CLAUDE.md]
```

(Add your own rules below)

---

## File Details

For each important file, document:

### `path/to/file` — Short Role Description
- **Role**: What this file does in your project.
- **Context**: How the AI typically interacts with this file.
- **Reliability**: High / Medium / Low (does it contain unverified info?)
- **Improvement Rules**: What conditions should be checked or added when a prompt
  references this file?

---

### Template Entries (delete after filling in)

#### `[planning-doc]` — Central Design Document
- **Role**: Core document covering design, rules, procedures, roadmaps, and notes.
- **Context**: The AI treats this as "Source of Truth."
- **Reliability**: High (user-authored), but may drift from actual code over time.
- **Improvement Rules**:
  - When referencing: check for plan-vs-code discrepancies. Specify which takes priority.
  - When modifying: cite exact section names to prevent AI from editing wrong sections.

#### `[reference-doc]` — Verified Technical Reference
- **Role**: Tested and confirmed technical patterns for the platform.
- **Context**: Pulled during implementation/verification for reliable patterns.
- **Reliability**: High.
- **Improvement Rules**:
  - Cite specific sections/functions, not just "refer to the reference doc."

#### `[ai-generated-doc]` — Platform Rule Reference
- **Role**: AI-generated reference explaining platform architecture and caveats.
- **Context**: Read on project entry, but contains `⚠ Investigation Needed` markers.
- **Reliability**: Low-Medium.
- **Improvement Rules**:
  - Always add "cross-verify with actual code behavior."
  - Use only when verified sources lack the needed info.

#### `[main-code]` — Main Implementation
- **Role**: Core code file — the final target for implementation and refactoring.
- **Reliability**: N/A (it's code).
- **Improvement Rules**:
  - Ensure modification scope is specified to prevent changing unrelated logic.

#### `[test-code]` — Test Environment
- **Role**: Test file for verifying code before integration.
- **Improvement Rules**:
  - Test instructions should include requirements for detailed debug output.

#### `[stable-baseline]` — Initial Stable Version
- **Role**: Stable baseline for comparison and partial rollbacks.
- **Improvement Rules**:
  - Rollback instructions must specify target scope — never overwrite the entire file.
