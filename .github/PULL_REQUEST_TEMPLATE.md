## What this changes

<!-- One or two sentences. Link the issue it fixes, e.g. Fixes #12. -->

## Why

<!-- The problem, not the solution. If this fixes a visual bug, say what it looked like before. -->

## How it was verified

<!-- Required. Which of these did you run, and paste the output. -->

- [ ] `npm test`, paste the summary lines
- [ ] `npm run measure`, if the change could affect layout
- [ ] Checked in a real browser, browser/version:
- [ ] Screenshot attached (before/after) for any visual change

## Checklist

- [ ] No `:has()` in any stylesheet
- [ ] No `$` in an unquoted id selector
- [ ] `src/` still has no runtime dependencies and no build step
- [ ] Version numbers untouched, or updated in all four places if this is a release
- [ ] Added or updated a `CHANGELOG.md` entry
