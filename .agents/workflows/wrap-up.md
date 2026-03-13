---
description: Synchronize session notes at session end (세션 마무리)
---

## Session Wrap-up

When the user signals session termination ("Let's wrap up", "세션 마무리", "작업 종료", etc.), perform the following document synchronization.

### Routing Rules

Before recording, determine which document each finding belongs to:

- **ARCHITECTURE.md** → what we built and why (module structure, design choices)
- **one-pager.md** → what we discovered while coding (API behaviors, gotchas)
- **HANDOFF.md** → task state (completed, blocked, next steps)
- **Changelog.md** → version releases only

### Synchronization Order

1. **one-pager.md**
   - Record bugs and API discoveries in Session Log
   - Promote verified findings to Evergreen Notes
   - If Evergreen Notes grows too large, move to `guide/` archive

2. **HANDOFF.md**
   - Overwrite entirely: what was done, what remains, next steps
   - Each session overwrites the previous contents

3. **Changelog.md**
   - Update only on version release
   - Keep last 4 versions detailed, compress older to one-line

4. **docs/ARCHITECTURE.md**
   - Update when module structure changes
   - Update when design decisions change

### Before Recording

- Check if content already exists before adding
- Do not duplicate findings across documents
- Update existing entries in-place, don't append duplicates
