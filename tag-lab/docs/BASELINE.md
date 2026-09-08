# Tag Lab implementation baseline

## Product boundary

Tag Lab is a standalone Windows `.exe`. It is not a mode of the mobile-first `nai-tag-builder` bookmarklet overlay. The two products may exchange data later, but neither owns the other's runtime or source tree.

`../mockup/shell-v18.html` remains the executable behavior and visual reference. Migration work must not edit or split that file. A feature is considered ported only when the new implementation has an explicit state owner and an automated check where the behavior is non-trivial.

## Confirmed behavior

- The main shell has four columns and a full-width collapsible floor.
- An artist is a leaf node and a chunk is a branch node containing artists or other chunks.
- Effective leaf weight is the product of every node weight on its path.
- Repeated artists reached through multiple paths are summed into one prompt tag.
- Direct prompt edits create or update a flat child fork; they do not mutate a library chunk.
- Negative values typed by the user are preserved. UI-generated negative artist values remain opt-in, and negative chunk controls remain unavailable.
- The catalog is not loaded in full at startup. Compact metadata and thumbnails may be bundled; larger images are loaded only when requested.
- Tournament ranking uses the exact top-three replay flow, supports coin decisions, and preserves enough history for undo and resume.
- Weight tuning operates on the current level's child axes and writes flattened artist values to a saved chunk card.
- Screen density is a first-class setting, not a cosmetic afterthought.

## Architecture boundaries

- `src/domain`: pure composition and experiment rules with no React, DOM, storage, or Tauri imports.
- `src/features`: workflow state and feature-specific views.
- `src/platform`: persistence, filesystem, NovelAI, and Tauri adapters.
- `src/app`: shell composition and application-level coordination.

React components render state and emit intent. Domain modules perform calculations and state transitions. Platform adapters handle side effects. The NovelAI implementation must sit behind an adapter so the UI and experiment rules can be verified without credentials or network access.

## Stage gates

1. Foundation: the web build succeeds, domain tests pass, and the Tauri configuration is valid.
2. Catalog: search, aliases, bundled thumbnails, and lazy detail loading work without loading the full catalog at startup.
3. Composition: the tree editor, prompt projection, prompt fork, and weight floor agree on effective artist weights.
4. Experiment: exact top-three ranking, coin review, undo, resume, tuning, and chunk save pass state-transition tests.
5. Integration: generation requests, cancellation, errors, seed pinning, and history are implemented through a replaceable NovelAI adapter.
6. Release: Playwright covers the critical user journey and a Windows release build is produced.

## Deferred decisions

- Library chunks default to snapshots for reproducibility. Reference semantics require an explicit migration decision.
- Tournament state is persisted first. Tuning persistence follows after the tuning model no longer contains live object references.
- Direct NovelAI HTTP and embedded-page automation remain adapter alternatives until the integration stage; neither may leak into domain or UI code.
- The default-split reading height of the artist encyclopedia remains a visual acceptance item for the shell migration.
