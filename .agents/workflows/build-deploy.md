---
description: Build the project and deploy to GitHub Pages via git push
---
// turbo-all

## Build & Deploy Pipeline

This project is a bookmarklet deployed via GitHub Pages. Every code change must go through the full pipeline.

1. Build the project
```bash
npm run build
```

2. Stage all changes
```bash
git add .
```

3. Commit with a descriptive message
```bash
git commit -m "<describe what changed>"
```

4. Push to trigger GitHub Actions deployment
```bash
git push
```

5. Verify the push succeeded by checking git status
```bash
git status
```

> If any step fails, stop and report the error. Do NOT skip to the next step.
> NEVER report a task as complete after only running `npm run build`.
