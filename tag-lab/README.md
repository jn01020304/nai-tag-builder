# Tag Lab

Tag Lab is a standalone Windows desktop application for comparing NovelAI artist combinations, ranking candidates, and tuning reusable weighted chunks.

The current implementation milestone is intentionally narrow:

- launch as an independent Tauri application;
- preserve `../mockup/shell-v18.html` as the behavioral reference;
- prove the artist/chunk composition model with automated tests;
- render the four-column shell and weight floor from that model.

## Commands

```bash
npm install
npm test
npm run build
npm run tauri dev
```

See `docs/BASELINE.md` for the migration boundaries and stage gates.
