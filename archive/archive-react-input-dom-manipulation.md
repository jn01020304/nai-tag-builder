### React Input DOM Manipulation Heuristic [INVALIDATED]
Source: Findings
Reason: Approach abandoned — React 19 controlled input DOM manipulation is fundamentally impossible per Evergreen "React Rendering". Useful knowledge already consolidated there.
Date: 2026-03-13
Original:
  Answers: Finding specific inputs (like Seed) in a compiled Next.js app is fragile — IDs/Names are often missing. Heuristic: walk the DOM for a "Seed" text node, traverse up to 5 parent levels, search siblings for `<input>`. Triggering React state: `input.focus()` → `nativeInputValueSetter.call(input, newValue)` → dispatch `input`, `change`, `keydown`, `keyup` events → `input.blur()`.
  Corrections: This sequence is NOT confirmed working on NovelAI. Per Evergreen "React Rendering", React 19 controlled input DOM manipulation is fundamentally impossible.
